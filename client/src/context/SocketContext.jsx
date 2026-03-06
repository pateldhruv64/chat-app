import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';
import { playOnlineChime } from '../utils/sounds';

const SocketContext = createContext();

export const useSocket = () => useContext(SocketContext);

export const SocketProvider = ({ children }) => {
    const { token, user } = useAuth();
    const socketRef = useRef(null);
    const [onlineUsers, setOnlineUsers] = useState(new Set());
    const [connected, setConnected] = useState(false);
    const [unreadCounts, setUnreadCounts] = useState({});
    const [lastSeenMap, setLastSeenMap] = useState({});
    const [soundEnabled, setSoundEnabled] = useState(() => {
        return localStorage.getItem('chatapp_sound_muted') !== 'true';
    });

    useEffect(() => {
        if (token && user) {
            let apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
            apiUrl = apiUrl.replace(/\/+$/, ''); // Strip any trailing slashes
            if (apiUrl.endsWith('/api')) apiUrl = apiUrl.slice(0, -4); // Strip /api tag

            const socket = io(apiUrl, {
                auth: { token },
                transports: ['websocket', 'polling'],
                secure: apiUrl.startsWith('https')
            });

            socket.on('connect', () => {
                setConnected(true);
            });

            socket.on('disconnect', () => {
                setConnected(false);
            });

            socket.on('userOnline', (userId) => {
                console.log('CLIENT: userOnline recvd ->', userId);
                setOnlineUsers((prev) => new Set([...prev, userId]));
                playOnlineChime();
            });

            // Receive list of friends already online when we first connect
            socket.on('friendsOnlineStatus', (onlineFriendIds) => {
                setOnlineUsers((prev) => new Set([...prev, ...onlineFriendIds]));
            });

            socket.on('userOffline', ({ userId: offlineUserId, lastSeen }) => {
                console.log('CLIENT: userOffline recvd ->', offlineUserId, lastSeen);
                const offlineUserIdStr = String(offlineUserId);
                setOnlineUsers((prev) => {
                    const next = new Set(prev);
                    next.delete(offlineUserIdStr);
                    return next;
                });
                if (lastSeen) {
                    setLastSeenMap((prev) => ({ ...prev, [offlineUserIdStr]: lastSeen }));
                }
            });

            // Track unread messages from notifications
            socket.on('messageNotification', ({ conversationId }) => {
                setUnreadCounts((prev) => ({
                    ...prev,
                    [conversationId]: (prev[conversationId] || 0) + 1,
                }));
            });

            socketRef.current = socket;

            return () => {
                socket.disconnect();
                socketRef.current = null;
            };
        } else if (!token || !user) {
            if (socketRef.current) {
                socketRef.current.emit('logout');
                socketRef.current.disconnect();
                socketRef.current = null;
            }
            setConnected(false);
            setOnlineUsers(new Set());
        }
    }, [token, user?._id]);

    const isUserOnline = useCallback((userId) => {
        return onlineUsers.has(userId);
    }, [onlineUsers]);

    const clearUnread = useCallback((conversationId) => {
        setUnreadCounts((prev) => {
            const next = { ...prev };
            delete next[conversationId];
            return next;
        });
    }, []);

    const initUnreadCounts = useCallback((conversations) => {
        const counts = {};
        conversations.forEach((conv) => {
            if (conv.unreadCount > 0) {
                counts[conv._id] = conv.unreadCount;
            }
        });
        setUnreadCounts((prev) => ({ ...counts, ...prev }));
    }, []);

    const getLastSeen = useCallback((userId) => {
        return lastSeenMap[userId] || null;
    }, [lastSeenMap]);

    const totalUnread = Object.values(unreadCounts).reduce((sum, c) => sum + c, 0);

    const toggleSound = useCallback(() => {
        setSoundEnabled((prev) => {
            const next = !prev;
            localStorage.setItem('chatapp_sound_muted', next ? 'false' : 'true');
            return next;
        });
    }, []);

    return (
        <SocketContext.Provider value={{
            socket: socketRef.current,
            onlineUsers,
            isUserOnline,
            connected,
            unreadCounts,
            clearUnread,
            initUnreadCounts,
            totalUnread,
            getLastSeen,
            lastSeenMap,
            soundEnabled,
            toggleSound,
        }}>
            {children}
        </SocketContext.Provider>
    );
};
