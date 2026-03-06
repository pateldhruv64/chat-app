import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useSocket } from '../context/SocketContext';
import { useState, useEffect } from 'react';
import API from '../utils/api';

const Navbar = () => {
    const { user, updateUser, logout } = useAuth();
    const { theme, toggleTheme } = useTheme();
    const { connected, totalUnread, soundEnabled, toggleSound, socket } = useSocket();
    const [pendingRequests, setPendingRequests] = useState(0);
    const location = useLocation();
    const navigate = useNavigate();

    // Fetch initial pending requests count
    useEffect(() => {
        if (!user) return;
        const fetchPending = async () => {
            try {
                const { data } = await API.get('/friends/requests');
                setPendingRequests(data.incoming?.length || 0);
            } catch (err) {
                console.error(err);
            }
        };
        fetchPending();
    }, [user]);

    // Listen for friend request changes globally
    useEffect(() => {
        if (!socket) return;

        const handleNewRequest = () => {
            setPendingRequests(prev => prev + 1);
        };

        const handleRequestProcessed = () => {
            setPendingRequests(prev => Math.max(0, prev - 1));
        };

        socket.on('friendRequestReceived', handleNewRequest);
        socket.on('friendRequestAccepted', handleRequestProcessed);
        socket.on('friendRequestRejected', handleRequestProcessed);

        return () => {
            socket.off('friendRequestReceived', handleNewRequest);
            socket.off('friendRequestAccepted', handleRequestProcessed);
            socket.off('friendRequestRejected', handleRequestProcessed);
        };
    }, [socket]);

    // Listen for own status toggle across tabs/devices
    useEffect(() => {
        if (!socket || !user) return;
        const handleStatusToggled = (newHiddenStatus) => {
            updateUser({ ...user, isHidden: newHiddenStatus });
        };
        socket.on('statusToggled', handleStatusToggled);
        return () => socket.off('statusToggled', handleStatusToggled);
    }, [socket, user, updateUser]);

    // Handle clearing the badge when moving to requests page
    useEffect(() => {
        if (location.pathname === '/requests') {
            // We assume once they visit the page, they've seen them.
            // But realistically, the count only goes down when they accept/reject.
            // For simplicity, we can just keep the fetched count accurate.
        }
    }, [location.pathname]);

    // Don't show on auth pages or chat page
    if (['/login', '/signup'].includes(location.pathname) || location.pathname.startsWith('/chat/')) {
        return null;
    }

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    return (
        <nav className="navbar">
            <div className="nav-brand">
                <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <img src="/mateify-logo.png" alt="Mateify Logo" className="brand-logo" style={{ width: '32px', height: '32px', objectFit: 'contain' }} />
                    <span className="brand-text">Mateify</span>
                </Link>
                {connected && <span className="connected-dot" title="Connected"></span>}
            </div>

            <div className="nav-links">
                <Link to="/" className={`nav-link ${location.pathname === '/' ? 'active' : ''}`} title="Home">
                    <span className="nav-link-inner">
                        🏠
                        {totalUnread > 0 && (
                            <span className="nav-unread-badge">{totalUnread > 99 ? '99+' : totalUnread}</span>
                        )}
                    </span>
                </Link>
                <Link to="/requests" className={`nav-link ${location.pathname === '/requests' ? 'active' : ''}`} title="Friend Requests">
                    <span className="nav-link-inner">
                        👋
                        {pendingRequests > 0 && (
                            <span className="nav-unread-badge req-badge">{pendingRequests > 99 ? '99+' : pendingRequests}</span>
                        )}
                    </span>
                </Link>
                <Link to="/profile" className={`nav-link ${location.pathname === '/profile' ? 'active' : ''}`} title="Profile">
                    👤
                </Link>
                <button onClick={toggleSound} className={`nav-link ${soundEnabled ? '' : 'muted'}`} title={soundEnabled ? 'Mute sounds' : 'Unmute sounds'}>
                    {soundEnabled ? '🔔' : '🔕'}
                </button>
                <button onClick={toggleTheme} className="nav-link theme-toggle" title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}>
                    {theme === 'dark' ? '☀️' : '🌙'}
                </button>
                <button onClick={handleLogout} className="nav-link logout-btn" title="Logout">
                    🚪
                </button>
            </div>
        </nav>
    );
};

export default Navbar;
