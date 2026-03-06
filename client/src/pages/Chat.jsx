import { useState, useEffect, useRef, useCallback } from 'react';
import { Virtuoso } from 'react-virtuoso';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import API from '../utils/api';
import EmojiPicker from '../components/EmojiPicker';
import ReactionPopup from '../components/ReactionPopup';
import { playSendSound, playReceiveSound } from '../utils/sounds';

import imageCompression from 'browser-image-compression';

const Chat = () => {
    const { conversationId } = useParams();
    const location = useLocation();
    const navigate = useNavigate();
    const { user } = useAuth();
    const { socket, isUserOnline, clearUnread, getLastSeen, connected } = useSocket();

    const [messages, setMessages] = useState([]);
    const [text, setText] = useState('');
    const [otherUser, setOtherUser] = useState(null);
    const [isTyping, setIsTyping] = useState(false);
    const [loading, setLoading] = useState(true);
    const [hasMore, setHasMore] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);

    // New feature states
    const [replyTo, setReplyTo] = useState(null);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [activeReactionMsgId, setActiveReactionMsgId] = useState(null);
    const [contextMenuMsgId, setContextMenuMsgId] = useState(null);
    const [contextMenuPos, setContextMenuPos] = useState({ x: 0, y: 0 });
    const [lastSeenText, setLastSeenText] = useState('');
    // Image upload
    const [uploadingImage, setUploadingImage] = useState(false);
    const [imagePreview, setImagePreview] = useState(null);
    const [pendingImageUrl, setPendingImageUrl] = useState(null);
    const fileInputRef = useRef(null);
    // Search
    const [showSearch, setShowSearch] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    // Pinned
    const [pinnedMessage, setPinnedMessage] = useState(null);
    // Forward
    const [forwardMsg, setForwardMsg] = useState(null);
    const [conversations, setConversations] = useState([]);
    const [showForwardModal, setShowForwardModal] = useState(false);

    const virtuosoRef = useRef(null);
    const containerRef = useRef(null);
    const typingTimeoutRef = useRef(null);
    const inputRef = useRef(null);
    const messageRefs = useRef({});
    const messagesEndRef = useRef(null);
    const isInitialLoad = useRef(true);
    const lastScrollHeight = useRef(0);
    const [showScrollBtn, setShowScrollBtn] = useState(false);
    const [newMsgCount, setNewMsgCount] = useState(0);

    // Get other user and fetch messages
    useEffect(() => {
        const initChat = async () => {
            let conv = location.state?.conversation;

            if (!conv && conversationId) {
                try {
                    const { data } = await API.get(`/messages/conv/${conversationId}`);
                    conv = data;
                } catch (err) {
                    console.error('Error fetching conversation:', err);
                }
            }

            if (conv) {
                const other = conv.participants.find((p) => p._id.toString() !== user._id.toString());
                setOtherUser(other);
                fetchMessages(other);
            } else {
                fetchMessages();
            }
        };

        initChat();
    }, [conversationId]);

    // Clear unread when opening conversation
    useEffect(() => {
        if (conversationId) {
            clearUnread(conversationId);
        }
    }, [conversationId, clearUnread]);

    // Join conversation room
    useEffect(() => {
        if (socket && conversationId && connected) {
            socket.emit('joinConversation', conversationId);

            return () => {
                socket.emit('leaveConversation', conversationId);
            };
        }
    }, [socket, conversationId, connected]);

    // Smart last seen — live updating
    useEffect(() => {
        if (!otherUser) return;

        const updateLastSeen = () => {
            if (isUserOnline(otherUser._id)) {
                setLastSeenText('');
                return;
            }
            const lastSeen = getLastSeen(otherUser._id) || otherUser.lastSeen;
            if (lastSeen) {
                setLastSeenText(formatLastSeen(lastSeen));
            } else {
                setLastSeenText('Offline');
            }
        };

        updateLastSeen();
        const interval = setInterval(updateLastSeen, 30000); // Update every 30s
        return () => clearInterval(interval);
    }, [otherUser, isUserOnline, getLastSeen]);

    // Listen for new messages
    useEffect(() => {
        if (!socket) return;

        const handleNewMessage = (message) => {
            if (message.conversationId === conversationId || message.conversationId?._id === conversationId) {

                // Play receive sound if from other user
                const senderId = message.sender._id || message.sender;
                if (senderId !== user._id) {
                    playReceiveSound();
                    // Show new message count if scrolled up
                    const container = containerRef.current;
                    if (container) {
                        const distFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
                        if (distFromBottom > 200) setNewMsgCount(prev => prev + 1);
                    }
                }

                const fromOtherUser = senderId !== user._id;

                setMessages((prev) => {
                    // Prevent duplicates
                    if (prev.find((m) => m._id === message._id)) return prev;

                    // Force seen status if from other user and chat is active
                    const newMsg = fromOtherUser ? { ...message, status: 'seen' } : message;

                    return [...prev, newMsg];
                });

                // Mark as seen on server if from other user
                if (fromOtherUser) {
                    socket.emit('markSeen', {
                        conversationId,
                        senderId,
                    });
                    clearUnread(conversationId);
                }
            }
        };

        const handleTyping = ({ userId: typingUserId, conversationId: typingConvId }) => {
            if (typingConvId === conversationId && typingUserId !== user._id) {
                setIsTyping(true);
            }
        };

        const handleStopTyping = ({ userId: typingUserId, conversationId: typingConvId }) => {
            if (typingConvId === conversationId && typingUserId !== user._id) {
                setIsTyping(false);
            }
        };

        const handleMessagesSeen = ({ conversationId: seenConvId }) => {
            console.log('Received messagesSeen for conv:', seenConvId, 'current:', conversationId);
            if (seenConvId === conversationId) {
                setMessages((prev) =>
                    prev.map((m) => {
                        const senderId = m.sender._id || m.sender;
                        if (senderId === user._id && m.status !== 'seen') {
                            return { ...m, status: 'seen' };
                        }
                        return m;
                    })
                );
            }
        };

        const handleStatusUpdate = ({ messageId, status }) => {
            setMessages((prev) =>
                prev.map((m) => (m._id === messageId ? { ...m, status } : m))
            );
        };

        // Reaction updates
        const handleReactionUpdated = ({ messageId, reactions }) => {
            setMessages((prev) =>
                prev.map((m) => (m._id === messageId ? { ...m, reactions } : m))
            );
        };

        // Delete for me
        const handleDeletedForMe = ({ messageId }) => {
            setMessages((prev) => prev.filter((m) => m._id !== messageId));
        };

        // Delete for everyone
        const handleDeletedForEveryone = ({ messageId }) => {
            console.log('Received deleteForEveryone for messageId:', messageId);
            setMessages((prev) =>
                prev.map((m) =>
                    m._id === messageId
                        ? { ...m, deletedForEveryone: true, text: '' }
                        : m
                )
            );
        };

        socket.on('newMessage', handleNewMessage);
        socket.on('userTyping', handleTyping);
        socket.on('userStoppedTyping', handleStopTyping);
        socket.on('messagesSeen', handleMessagesSeen);
        socket.on('messageStatusUpdate', handleStatusUpdate);
        socket.on('reactionUpdated', handleReactionUpdated);
        socket.on('messageDeletedForMe', handleDeletedForMe);
        socket.on('messageDeletedForEveryone', handleDeletedForEveryone);

        const handlePinned = ({ messageId, isPinned }) => {
            setMessages(prev => prev.map(m => m._id === messageId ? { ...m, isPinned } : m));
            if (isPinned) {
                setMessages(prev => {
                    const pinned = prev.find(m => m._id === messageId);
                    if (pinned) setPinnedMessage({ ...pinned, isPinned: true });
                    return prev;
                });
            } else {
                setPinnedMessage(null);
            }
        };
        socket.on('messagePinned', handlePinned);

        return () => {
            socket.off('newMessage', handleNewMessage);
            socket.off('userTyping', handleTyping);
            socket.off('userStoppedTyping', handleStopTyping);
            socket.off('messagesSeen', handleMessagesSeen);
            socket.off('messageStatusUpdate', handleStatusUpdate);
            socket.off('reactionUpdated', handleReactionUpdated);
            socket.off('messageDeletedForMe', handleDeletedForMe);
            socket.off('messageDeletedForEveryone', handleDeletedForEveryone);
            socket.off('messagePinned', handlePinned);
        };
    }, [socket, conversationId, user._id, clearUnread]);

    // Auto-scroll
    useEffect(() => {
        if (isInitialLoad.current && messages.length > 0) {
            messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
            isInitialLoad.current = false;
        } else if (!loadingMore && messages.length > 0) {
            const lastMsg = messages[messages.length - 1];
            const isMine = lastMsg && (lastMsg.sender._id || lastMsg.sender) === user._id;

            if (isMine) {
                messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
            } else {
                const container = containerRef.current;
                if (container) {
                    const distFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
                    // Auto scroll if user is reasonably close to bottom
                    if (distFromBottom < 300) {
                        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
                    }
                }
            }
        }
    }, [messages, isTyping, user._id, loadingMore]);

    // Maintain scroll position when older messages load
    // Virtuoso handles this natively via firstItemIndex updates
    // Close context menu on click outside
    useEffect(() => {
        const handleClick = () => {
            setContextMenuMsgId(null);
            setActiveReactionMsgId(null);
        };
        document.addEventListener('click', handleClick);
        return () => document.removeEventListener('click', handleClick);
    }, []);

    const fetchMessages = async (otherUserOverride) => {
        try {
            setLoading(true);
            isInitialLoad.current = true;
            const { data } = await API.get(`/messages/${conversationId}?limit=50`);
            setMessages(data.messages);
            setHasMore(data.hasMore);

            // Mark messages as seen
            const targetUser = otherUserOverride || otherUser;
            if (socket && targetUser) {
                socket.emit('markSeen', {
                    conversationId,
                    senderId: targetUser._id,
                });
                clearUnread(conversationId);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const loadMoreMessages = async () => {
        if (loadingMore || !hasMore || messages.length === 0) return;

        try {
            setLoadingMore(true);
            const oldestMessage = messages[0];
            const cursor = oldestMessage.createdAt;

            const { data } = await API.get(`/messages/${conversationId}?cursor=${cursor}&limit=50`);

            if (data.messages.length > 0) {
                setMessages((prev) => [...data.messages, ...prev]);
                setHasMore(data.hasMore);
            } else {
                setHasMore(false);
            }
        } catch (err) {
            console.error('Error loading more messages:', err);
        } finally {
            setLoadingMore(false);
        }
    };

    // Handle user scrolling up/down logic
    const handleScroll = (e) => {
        const { scrollTop, scrollHeight, clientHeight } = e.target;
        const atBottom = scrollHeight - scrollTop - clientHeight < 50;
        setShowScrollBtn(!atBottom);
        if (atBottom) {
            setNewMsgCount(0);
        }

        if (scrollTop === 0 && hasMore && !loadingMore) {
            // Reached top, fetch older messages
            loadMoreMessages();
        }
    };

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        setNewMsgCount(0);
    };

    const handleSend = (e) => {
        e.preventDefault();
        if ((!text.trim() && !pendingImageUrl) || !socket || !otherUser) return;

        socket.emit('sendMessage', {
            conversationId,
            receiverId: otherUser._id,
            text: text.trim(),
            imageUrl: pendingImageUrl || '',
            replyTo: replyTo?._id || null,
        });

        playSendSound();

        socket.emit('stopTyping', {
            conversationId,
            receiverId: otherUser._id,
        });

        setText('');
        setReplyTo(null);
        setShowEmojiPicker(false);
        cancelImagePreview();
        inputRef.current?.focus();
    };

    const handleTypingEvent = useCallback(() => {
        if (!socket || !otherUser) return;

        socket.emit('typing', {
            conversationId,
            receiverId: otherUser._id,
        });

        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => {
            socket.emit('stopTyping', {
                conversationId,
                receiverId: otherUser._id,
            });
        }, 2000);
    }, [socket, conversationId, otherUser]);

    // Reaction handlers
    const handleReact = (messageId, emoji) => {
        if (!socket) return;
        socket.emit('addReaction', { messageId, emoji, conversationId });
        setActiveReactionMsgId(null);
    };

    const handleRemoveReaction = (messageId) => {
        if (!socket) return;
        socket.emit('removeReaction', { messageId, conversationId });
        setActiveReactionMsgId(null);
    };

    // Delete handlers
    const handleDeleteForMe = (messageId) => {
        if (!socket) return;
        socket.emit('deleteForMe', { messageId, conversationId });
        setContextMenuMsgId(null);
    };

    const handleDeleteForEveryone = (messageId) => {
        if (!socket) return;
        socket.emit('deleteForEveryone', { messageId, conversationId });
        setContextMenuMsgId(null);
    };

    // Image upload
    const handleImageSelect = async (e) => {
        let file = e.target.files[0];
        if (!file) return;
        setUploadingImage(true);
        setImagePreview(URL.createObjectURL(file));
        try {
            const options = {
                maxSizeMB: 1,
                maxWidthOrHeight: 1200,
                useWebWorker: true,
            };
            file = await imageCompression(file, options);

            const formData = new FormData();
            formData.append('image', file);
            const { data } = await API.post('/upload/image', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            setPendingImageUrl(data.url);
        } catch (err) {
            console.error('Image upload failed', err);
            alert('Image upload failed');
            setImagePreview(null);
        } finally {
            setUploadingImage(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const cancelImagePreview = () => {
        setImagePreview(null);
        setPendingImageUrl(null);
    };

    // Pin / Unpin
    const handlePin = (msg) => {
        if (!socket) return;
        const isPinning = !msg.isPinned;
        socket.emit(isPinning ? 'pinMessage' : 'unpinMessage', { messageId: msg._id, conversationId });
        setContextMenuMsgId(null);
        setMessages(prev => prev.map(m => m._id === msg._id ? { ...m, isPinned: isPinning } : m));
        setPinnedMessage(isPinning ? msg : null);
    };

    // Forward
    const openForwardModal = async (msg) => {
        setForwardMsg(msg);
        setContextMenuMsgId(null);
        try {
            const { data } = await API.get('/messages/conversations');
            setConversations(data.filter(c => c._id !== conversationId));
        } catch (err) { console.error(err); }
        setShowForwardModal(true);
    };

    const handleForward = (targetConv) => {
        if (!socket || !forwardMsg) return;
        const other = targetConv.participants.find(p => p._id.toString() !== user._id.toString());
        if (!other) return;
        socket.emit('forwardMessage', {
            messageId: forwardMsg._id,
            targetConversationId: targetConv._id,
            receiverId: other._id,
        });
        setShowForwardModal(false);
        setForwardMsg(null);
    };

    // Context menu
    const handleContextMenu = (e, msgId) => {
        e.preventDefault();
        e.stopPropagation();
        setContextMenuMsgId(msgId);
        setContextMenuPos({ x: e.clientX, y: e.clientY });
    };

    // Scroll to replied message
    const scrollToMessage = (msgId) => {
        const index = messages.findIndex(m => m._id === msgId);
        if (index !== -1) {
            const msgElement = messageRefs.current[msgId];
            if (msgElement) {
                msgElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                msgElement.classList.add('highlight-msg');
                setTimeout(() => msgElement.classList.remove('highlight-msg'), 2000);
            }
        }
    };

    // Emoji insert
    const handleEmojiSelect = (emoji) => {
        setText((prev) => prev + emoji);
        inputRef.current?.focus();
    };

    // Get current user's reaction on a message
    const getUserReaction = (msg) => {
        if (!msg.reactions || msg.reactions.length === 0) return null;
        const r = msg.reactions.find((r) => (r.userId?._id || r.userId) === user._id);
        return r?.emoji || null;
    };

    // Group reactions by emoji
    const groupReactions = (reactions) => {
        if (!reactions || reactions.length === 0) return [];
        const map = {};
        reactions.forEach((r) => {
            if (!map[r.emoji]) map[r.emoji] = { count: 0, users: [] };
            map[r.emoji].count++;

            // Note: server needs to populate userId's username/displayName for this to be perfect,
            // but for now we fallback to 'Someone' if not populated
            const userName = typeof r.userId === 'object'
                ? (r.userId?.displayName || r.userId?.username || 'User')
                : (r.userId === user._id ? (user.displayName || user.username) : 'Someone');

            map[r.emoji].users.push(userName);
        });
        return Object.entries(map).map(([emoji, data]) => ({ emoji, count: data.count, users: data.users }));
    };

    const getStatusIcon = (status) => {
        switch (status) {
            case 'sent': return '✓';
            case 'delivered': return '✓✓';
            case 'seen': return <span className="seen-check">✓✓</span>;
            default: return '';
        }
    };

    const formatTime = (date) => {
        return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const formatLastSeen = (date) => {
        if (!date) return 'Offline';
        const now = new Date();
        const d = new Date(date);
        const diff = now - d;
        const mins = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);

        if (mins < 1) return 'Last seen just now';
        if (mins < 60) return `Last seen ${mins}m ago`;
        if (hours < 24) return `Last seen ${hours}h ago`;
        if (days === 1) return 'Last seen yesterday';
        return `Last seen ${d.toLocaleDateString()}`;
    };

    if (!otherUser && !loading) {
        return (
            <div className="chat-page page-enter">
                <div className="empty-state">
                    <h3>Chat not found</h3>
                    <button onClick={() => navigate('/')} className="btn btn-primary">Go Home</button>
                </div>
            </div>
        );
    }
    const handleBlock = async () => {
        if (!otherUser) return;
        if (window.confirm(`Are you sure you want to block ${otherUser.displayName || otherUser.username}?`)) {
            try {
                await API.post(`/users/block/${otherUser._id}`);
                // Assuming otherUser is derived or passed, and navigating away clears the chat state
                setMessages([]); // Clear messages locally
                navigate('/'); // Go back to home/conversations list
            } catch (err) {
                console.error('Failed to block user:', err);
                alert('Failed to block user');
            }
        }
    };

    return (
        <div className="chat-page page-enter">
            {/* Chat Header */}
            <div className="chat-header">
                <button className="btn-back" onClick={() => navigate('/')}>←</button>
                <div className="chat-header-user">
                    <div className="conv-avatar-wrapper">
                        <div className="user-avatar sm">
                            {otherUser?.avatar ? (
                                <img src={otherUser.avatar} alt="" />
                            ) : otherUser?.gender === 'Male' ? (
                                <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Felix&mouth=smile&eyebrows=default&eyes=default" alt="" />
                            ) : otherUser?.gender === 'Female' ? (
                                <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Aria&mouth=smile&eyebrows=default&eyes=default" alt="" />
                            ) : (
                                otherUser?.displayName?.[0]?.toUpperCase() || otherUser?.username?.[0]?.toUpperCase() || '?'
                            )}
                        </div>
                        {otherUser && isUserOnline(otherUser._id) && <span className="online-dot sm"></span>}
                    </div>
                    <div>
                        <h3>{otherUser?.displayName || otherUser?.username || 'Loading...'}</h3>
                        <span className="chat-status">
                            {isTyping
                                ? 'typing...'
                                : otherUser && isUserOnline(otherUser._id)
                                    ? 'Online'
                                    : lastSeenText || 'Offline'}
                        </span>
                    </div>
                </div>
                {otherUser && (
                    <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                            onClick={() => { setShowSearch(p => !p); setSearchQuery(''); }}
                            className="btn-icon"
                            title="Search messages"
                        >🔍</button>
                        <button onClick={handleBlock} className="btn-icon danger" title="Block User">🚫</button>
                    </div>
                )}
            </div>

            {/* Search Bar */}
            {showSearch && (
                <div className="chat-search-bar">
                    <input
                        type="text"
                        placeholder="Search messages..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        autoFocus
                    />
                    <button onClick={() => { setShowSearch(false); setSearchQuery(''); }} className="btn-icon">✕</button>
                </div>
            )}

            {/* Pinned message banner */}
            {pinnedMessage && (
                <div className="pinned-banner" onClick={() => scrollToMessage(pinnedMessage._id)}>
                    <span className="pinned-icon">📌</span>
                    <span className="pinned-text">{pinnedMessage.imageUrl ? '📷 Image' : pinnedMessage.text}</span>
                    <button className="pinned-close" onClick={e => { e.stopPropagation(); setPinnedMessage(null); }}>✕</button>
                </div>
            )}

            {/* Messages */}
            <div className="messages-container" ref={containerRef} onScroll={handleScroll}>
                {loading ? (
                    <div className="loading-center"><span className="spinner lg"></span></div>
                ) : (
                    <>
                        {loadingMore && (
                            <div className="loading-more">
                                <span className="spinner sm"></span>
                            </div>
                        )}
                        {messages.length === 0 ? (
                            <div className="empty-chat">
                                <span>👋</span>
                                <p>Say hello! Start the conversation.</p>
                            </div>
                        ) : (
                            (searchQuery ? messages.filter(m => m.text?.toLowerCase().includes(searchQuery.toLowerCase())) : messages).map((msg) => {
                                const isMine = (msg.sender._id || msg.sender) === user._id;
                                const isDeleted = msg.deletedForEveryone;

                                return (
                                    <div
                                        key={msg._id}
                                        ref={(el) => (messageRefs.current[msg._id] = el)}
                                        className={`message-wrapper ${isMine ? 'mine' : 'theirs'}`}
                                    >
                                        <div
                                            className={`message-bubble ${isMine ? 'mine msg-slide-right' : 'theirs msg-slide-left'}`}
                                            onContextMenu={(e) => handleContextMenu(e, msg._id)}
                                        >
                                            {isDeleted ? (
                                                <p className="message-deleted">🚫 This message was deleted</p>
                                            ) : (
                                                <>
                                                    {/* Reply preview */}
                                                    {msg.replyTo && (
                                                        <div
                                                            className="reply-preview-bubble"
                                                            onClick={() => scrollToMessage(msg.replyTo._id)}
                                                        >
                                                            <span className="reply-preview-author">
                                                                {msg.replyTo.sender?.displayName || msg.replyTo.sender?.username || 'User'}
                                                            </span>
                                                            <span className="reply-preview-text">
                                                                {msg.replyTo.imageUrl ? '📷 Image' : msg.replyTo.text}
                                                            </span>
                                                        </div>
                                                    )}
                                                    {/* Image message */}
                                                    {msg.imageUrl && (
                                                        <div className="msg-image-wrapper">
                                                            <img
                                                                src={msg.imageUrl}
                                                                alt="Sent image"
                                                                className="msg-image"
                                                                onClick={() => window.open(msg.imageUrl, '_blank')}
                                                            />
                                                        </div>
                                                    )}
                                                    {msg.text && <p className="message-text">{msg.text}</p>}
                                                    {msg.isPinned && <span className="pinned-tag">📌</span>}
                                                </>
                                            )}
                                            <div className="message-meta">
                                                <span className="message-time">{formatTime(msg.createdAt)}</span>
                                                {isMine && <span className="message-status">{getStatusIcon(msg.status)}</span>}
                                            </div>

                                            {/* Reaction trigger */}
                                            {!isDeleted && (
                                                <button
                                                    className="reaction-trigger"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setActiveReactionMsgId(activeReactionMsgId === msg._id ? null : msg._id);
                                                    }}
                                                >
                                                    😊
                                                </button>
                                            )}

                                            {/* Actions trigger */}
                                            {!isDeleted && (
                                                <button
                                                    className="msg-actions-trigger"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleContextMenu(e, msg._id);
                                                    }}
                                                >
                                                    ⋮
                                                </button>
                                            )}

                                            {/* Reaction popup */}
                                            {activeReactionMsgId === msg._id && (
                                                <div onClick={(e) => e.stopPropagation()}>
                                                    <ReactionPopup
                                                        onReact={(emoji) => handleReact(msg._id, emoji)}
                                                        onRemove={() => handleRemoveReaction(msg._id)}
                                                        currentUserReaction={getUserReaction(msg)}
                                                    />
                                                </div>
                                            )}
                                        </div>

                                        {/* Reactions display */}
                                        {msg.reactions && msg.reactions.length > 0 && (
                                            <div className={`reactions-row ${isMine ? 'mine' : 'theirs'}`}>
                                                {groupReactions(msg.reactions).map(({ emoji, count, users }) => (
                                                    <span key={emoji} className="reaction-pill" title={users.join(', ')}>
                                                        {emoji} {count > 1 && <span className="reaction-count">{count}</span>}
                                                    </span>
                                                ))}
                                            </div>
                                        )}

                                        {/* Context menu */}
                                        {contextMenuMsgId === msg._id && (
                                            <div
                                                className="msg-context-menu"
                                                style={{ top: contextMenuPos.y, left: contextMenuPos.x }}
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                {!isDeleted && (
                                                    <button onClick={() => { setReplyTo(msg); setContextMenuMsgId(null); inputRef.current?.focus(); }}>
                                                        ↩️ Reply
                                                    </button>
                                                )}
                                                {!isDeleted && (
                                                    <button onClick={() => openForwardModal(msg)}>↪️ Forward</button>
                                                )}
                                                {!isDeleted && (
                                                    <button onClick={() => handlePin(msg)}>
                                                        {msg.isPinned ? '📌 Unpin' : '📌 Pin'}
                                                    </button>
                                                )}
                                                <button onClick={() => handleDeleteForMe(msg._id)}>🗑️ Delete for me</button>
                                                {isMine && !isDeleted && (
                                                    <button onClick={() => handleDeleteForEveryone(msg._id)} className="danger">🗑️ Delete for everyone</button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })
                        )}
                        {isTyping && (
                            <div className="typing-indicator">
                                <div className="typing-dots">
                                    <span></span><span></span><span></span>
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </>
                )}
            </div>

            {/* Scroll to bottom button */}
            {showScrollBtn && (
                <button className="scroll-to-bottom-btn" onClick={scrollToBottom}>
                    ↓
                    {newMsgCount > 0 && <span className="scroll-unread-badge">{newMsgCount}</span>}
                </button>
            )}

            {/* Reply / Image preview above input */}
            <div className="pre-input-container">
                {replyTo && (
                    <div className="reply-bar">
                        <div className="reply-bar-content">
                            <span className="reply-bar-label">↩️ Replying to</span>
                            <span className="reply-bar-text">{replyTo.imageUrl ? '📷 Image' : replyTo.text}</span>
                        </div>
                        <button className="reply-bar-close" onClick={() => setReplyTo(null)}>✕</button>
                    </div>
                )}
                {imagePreview && (
                    <div className="image-preview-bar">
                        <div className="image-preview-content">
                            <span className="image-preview-label">📷 Attached Image</span>
                            <img src={imagePreview} alt="Preview" className="image-preview-thumb" />
                            {uploadingImage && <span className="spinner sm image-upload-spinner"></span>}
                        </div>
                        <button className="image-preview-close" onClick={cancelImagePreview}>✕</button>
                    </div>
                )}
            </div>

            {/* Emoji Picker */}
            {showEmojiPicker && (
                <EmojiPicker
                    onSelect={handleEmojiSelect}
                    onClose={() => setShowEmojiPicker(false)}
                />
            )}

            {/* Input */}
            <form className="chat-input-form" onSubmit={handleSend}>
                <button
                    type="button"
                    className="btn-emoji-toggle"
                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                >😊</button>
                <button
                    type="button"
                    className="btn-emoji-toggle"
                    onClick={() => fileInputRef.current?.click()}
                >📷</button>
                <input
                    type="file"
                    accept="image/*"
                    ref={fileInputRef}
                    style={{ display: 'none' }}
                    onChange={handleImageSelect}
                />
                <input
                    ref={inputRef}
                    type="text"
                    value={text}
                    onChange={(e) => {
                        setText(e.target.value);
                        handleTypingEvent();
                    }}
                    placeholder="Type a message..."
                    className="chat-input"
                    autoFocus
                />
                <button
                    type="submit"
                    className="btn btn-send"
                    disabled={(!text.trim() && !pendingImageUrl) || uploadingImage}
                >➤</button>
            </form>

            {/* Forward Modal */}
            {showForwardModal && (
                <div className="modal-overlay" onClick={() => { setShowForwardModal(false); setForwardMsg(null); }}>
                    <div className="modal-content file-modal" onClick={e => e.stopPropagation()}>
                        <h3>Forward Message</h3>
                        <div className="forward-preview">
                            {forwardMsg?.imageUrl ? '📷 Image' : forwardMsg?.text}
                        </div>
                        <div className="forward-list">
                            {conversations.length === 0 ? (
                                <p className="empty-text">No other conversations</p>
                            ) : (
                                conversations.map(c => {
                                    const other = c.participants.find(p => p._id.toString() !== user._id.toString());
                                    if (!other) return null;
                                    return (
                                        <div key={c._id} className="forward-item" onClick={() => handleForward(c)}>
                                            <img
                                                src={other.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${other.username}`}
                                                alt=""
                                                className="forward-avatar"
                                            />
                                            <span>{other.displayName || other.username}</span>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                        <div className="modal-actions">
                            <button className="btn btn-secondary" onClick={() => { setShowForwardModal(false); setForwardMsg(null); }}>Cancel</button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
};

export default Chat;
