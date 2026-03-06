import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import API from '../utils/api';

const GenderIcon = ({ gender }) => {
    if (gender === 'Male') return <span className="gender-label male" title="Male">👦 Boy</span>;
    if (gender === 'Female') return <span className="gender-label female" title="Female">👧 Girl</span>;
    return null;
};

const getStatusIcon = (status) => {
    if (status === 'seen') return <span style={{ color: '#60a5fa', fontSize: '0.7rem', fontWeight: 700 }}>✓✓</span>;
    if (status === 'delivered') return <span style={{ opacity: 0.7, fontSize: '0.7rem' }}>✓✓</span>;
    if (status === 'sent') return <span style={{ opacity: 0.5, fontSize: '0.7rem' }}>✓</span>;
    return null;
};

const UserAvatar = ({ user, size = '' }) => {
    const { avatar, gender, displayName, username } = user;
    const name = displayName || username;

    if (avatar) return <div className={`user-avatar ${size}`}><img src={avatar} alt="" /></div>;
    if (gender === 'Male') return <div className={`user-avatar ${size}`}><img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Felix&mouth=smile&eyebrows=default&eyes=default" alt="" /></div>;
    if (gender === 'Female') return <div className={`user-avatar ${size}`}><img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Aria&mouth=smile&eyebrows=default&eyes=default" alt="" /></div>;

    return (
        <div className={`user-avatar ${size}`}>
            <div className="letter-avatar">{name?.[0]?.toUpperCase() || '👤'}</div>
        </div>
    );
};

const ConversationSkeleton = () => (
    <div className="conversation-item skeleton-item">
        <div className="skeleton-avatar"></div>
        <div className="skeleton-details">
            <div className="skeleton-line short"></div>
            <div className="skeleton-line long"></div>
        </div>
    </div>
);

const Home = () => {
    const { user } = useAuth();
    const { isUserOnline, unreadCounts, initUnreadCounts, getLastSeen, totalUnread } = useSocket();
    const navigate = useNavigate();

    const [friends, setFriends] = useState([]);
    const [suggestions, setSuggestions] = useState([]);
    const [conversations, setConversations] = useState([]);
    const [loadingChats, setLoadingChats] = useState(true);
    const [genderFilter, setGenderFilter] = useState('All');
    const [minAge, setMinAge] = useState(13);
    const [maxAge, setMaxAge] = useState(100);
    const [sugPage, setSugPage] = useState(1);
    const [hasMore, setHasMore] = useState(false);
    const [loadingSuggestions, setLoadingSuggestions] = useState(false);
    const [totalSug, setTotalSug] = useState(0);
    const [searchId, setSearchId] = useState('');
    const [searchResult, setSearchResult] = useState(null);
    const [searchError, setSearchError] = useState('');
    const [requestSent, setRequestSent] = useState(new Set());
    const [tab, setTab] = useState('chats');

    useEffect(() => {
        fetchFriends();
        fetchConversations();
    }, []);

    useEffect(() => {
        fetchSuggestions(1, true);
    }, [genderFilter, minAge, maxAge]);

    const handleRemoveFriend = async (friendId) => {
        try {
            await API.post(`/friends/remove/${friendId}`);
            setFriends((prev) => prev.filter((f) => f._id !== friendId));
            setConversations((prev) => prev.filter((conv) => {
                const other = getOtherParticipant(conv);
                return other?._id !== friendId;
            }));
        } catch (err) {
            alert('Failed to remove friend');
        }
    };

    const fetchFriends = async () => {
        try {
            const { data } = await API.get('/friends/list');
            setFriends(data);
        } catch (err) {
            console.error(err);
        }
    };

    const fetchConversations = async () => {
        try {
            setLoadingChats(true);
            const { data } = await API.get('/messages/conversations');
            setConversations(data);
            initUnreadCounts(data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoadingChats(false);
        }
    };

    const fetchSuggestions = async (page = 1, isNewFilter = false) => {
        setLoadingSuggestions(true);
        try {
            const { data } = await API.get('/users/suggestions', {
                params: {
                    gender: genderFilter,
                    minAge,
                    maxAge,
                    page,
                    limit: 10,
                },
            });
            if (isNewFilter) {
                setSuggestions(data.users);
            } else {
                setSuggestions((prev) => [...prev, ...data.users]);
            }
            setHasMore(data.hasMore);
            setTotalSug(data.total);
            setSugPage(page); // Keep this line for pagination logic
        } catch (err) {
            console.error(err);
        } finally {
            setLoadingSuggestions(false);
        }
    };

    const handleSearch = async (e) => {
        e.preventDefault();
        setSearchError('');
        setSearchResult(null);
        if (!searchId.trim()) return;
        try {
            const { data } = await API.get(`/users/search/${searchId.trim()}`);
            setSearchResult(data);
        } catch (err) {
            setSearchError(err.response?.data?.message || 'User not found');
        }
    };

    const sendRequest = async (userId) => {
        try {
            await API.post(`/friends/request/${userId}`);
            setRequestSent((prev) => new Set([...prev, userId]));
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to send request');
        }
    };

    const openChat = async (friendId) => {
        try {
            const { data } = await API.get(`/messages/conversation/${friendId}`);
            navigate(`/chat/${data._id}`, { state: { conversation: data } });
        } catch (err) {
            console.error(err);
        }
    };

    const getOtherParticipant = (conv) => {
        return conv.participants.find((p) => p._id.toString() !== user._id.toString());
    };

    const formatTime = (date) => {
        if (!date) return '';
        const d = new Date(date);
        const now = new Date();
        const diff = now - d;
        if (diff < 60000) return 'Just now';
        if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
        if (diff < 86400000) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        return d.toLocaleDateString();
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

    return (
        <div className="home-page page-enter">
            {/* Search Bar */}
            <div className="search-section">
                <form onSubmit={handleSearch} className="search-form">
                    <input
                        type="text"
                        value={searchId}
                        onChange={(e) => setSearchId(e.target.value)}
                        placeholder="Search by Unique ID..."
                        className="search-input"
                    />
                    <button type="submit" className="btn btn-primary btn-sm">Search</button>
                </form>

                {searchResult && (
                    <div className="search-result-card premium-card">
                        <div className="user-avatar-wrapper">
                            <UserAvatar user={searchResult} />
                            {searchResult.isFriend && <span className="friend-badge-dot" title="Friend">✓</span>}
                        </div>
                        <div className="user-info">
                            <div className="name-status-row">
                                <h4>{searchResult.displayName || searchResult.username} <GenderIcon gender={searchResult.gender} /></h4>
                                {searchResult.isFriend && <span className="relationship-tag">Friend</span>}
                                {searchResult.isPending && <span className="relationship-tag pending">Pending</span>}
                            </div>
                            <span className="user-uid">ID: {searchResult.uniqueId}</span>
                        </div>
                        <div className="search-actions">
                            {searchResult.isFriend ? (
                                <button onClick={() => openChat(searchResult._id)} className="btn btn-ghost btn-sm">
                                    Message
                                </button>
                            ) : searchResult.isPending || requestSent.has(searchResult._id) ? (
                                <span className="badge badge-sent">Request Sent</span>
                            ) : (
                                <button onClick={() => sendRequest(searchResult._id)} className="btn btn-primary btn-sm">
                                    Add Friend
                                </button>
                            )}
                        </div>
                    </div>
                )}
                {searchError && <p className="search-error">{searchError}</p>}
            </div>

            {/* Tabs */}
            <div className="home-tabs">
                <button className={`tab-btn ${tab === 'chats' ? 'active' : ''}`} onClick={() => setTab('chats')}>
                    💬 Chats
                    {totalUnread > 0 && <span className="unread-badge tab-badge">{totalUnread > 99 ? '99+' : totalUnread}</span>}
                </button>
                <button className={`tab-btn ${tab === 'friends' ? 'active' : ''}`} onClick={() => setTab('friends')}>
                    👥 Friends {friends.length > 0 && <span className="tab-count">{friends.length}</span>}
                </button>
            </div>

            {/* Chats Tab */}
            {tab === 'chats' && (
                <div className="conversations-list">
                    {loadingChats ? (
                        <>
                            <ConversationSkeleton />
                            <ConversationSkeleton />
                            <ConversationSkeleton />
                            <ConversationSkeleton />
                        </>
                    ) : conversations.length === 0 ? (
                        <div className="empty-state">
                            <span className="empty-icon">💬</span>
                            <h3>No conversations yet</h3>
                            <p>No conversations yet.</p>
                        </div>
                    ) : (
                        conversations.map((conv) => {
                            const other = getOtherParticipant(conv);
                            if (!other) return null;
                            const convUnread = unreadCounts[conv._id] || 0;
                            return (
                                <div key={conv._id} className="conversation-item conv-hover-ripple" onClick={() => navigate(`/chat/${conv._id}`, { state: { conversation: conv } })}>
                                    <div className="conv-avatar-wrapper">
                                        <UserAvatar user={other} />
                                        {isUserOnline(other._id) && <span className="online-dot small"></span>}
                                    </div>
                                    <div className="conv-info">
                                        <div className="conv-name-row" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <h4 style={{ margin: 0 }}>{other.displayName || other.username} <GenderIcon gender={other.gender} /></h4>
                                            <span className="conv-time" style={{ marginLeft: 'auto' }}>{formatTime(conv.updatedAt)}</span>
                                        </div>
                                        <p className="conv-last-msg">
                                            {conv.lastMessage?.deletedForEveryone
                                                ? '🚫 This message was deleted'
                                                : <>
                                                    {conv.lastMessage?.sender?._id?.toString() === user._id?.toString() && getStatusIcon(conv.lastMessage?.status)}
                                                    {conv.lastMessage?.text || 'Start a conversation'}
                                                </>
                                            }
                                        </p>
                                    </div>
                                    <div className="conv-meta">
                                        <div className="conv-meta-actions">
                                            {convUnread > 0 && (
                                                <span className="unread-badge">{convUnread > 99 ? '99+' : convUnread}</span>
                                            )}
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (window.confirm(`Remove ${other.displayName || other.username} from friends?`)) {
                                                        handleRemoveFriend(other._id);
                                                    }
                                                }}
                                                className="btn-remove-conv"
                                                title="Remove Friend"
                                            >
                                                ×
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            )}

            {/* Friends Tab */}
            {tab === 'friends' && (
                <div className="friends-section">
                    {friends.length > 0 && (
                        <div className="friends-grid">
                            {friends.map((friend) => {
                                const online = isUserOnline(friend._id);
                                const lastSeen = getLastSeen(friend._id) || friend.lastSeen;
                                return (
                                    <div key={friend._id} className="friend-card">
                                        <div className="friend-info-click" onClick={() => openChat(friend._id)}>
                                            <div className="friend-avatar-wrapper">
                                                <UserAvatar user={friend} size="lg" />
                                                {online && <span className="online-dot"></span>}
                                            </div>
                                            <h4>{friend.displayName || friend.username} <GenderIcon gender={friend.gender} /></h4>
                                            <span className="friend-status">
                                                {online ? '🟢 Online' : formatLastSeen(lastSeen)}
                                            </span>
                                        </div>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (window.confirm(`Remove ${friend.displayName || friend.username} from friends?`)) {
                                                    handleRemoveFriend(friend._id);
                                                }
                                            }}
                                            className="btn-remove-friend"
                                            title="Remove Friend"
                                        >
                                            👤×
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    <div className="suggestions-section" style={{ marginTop: friends.length > 0 ? '40px' : '0' }}>
                        <div className="suggestions-header">
                            <h3>{friends.length > 0 ? '✨ Find More People' : '✨ Friend Suggestions'}</h3>
                            <div className="discovery-filters" style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                                <select
                                    value={genderFilter}
                                    onChange={(e) => { setGenderFilter(e.target.value); setSugPage(1); }}
                                    className="gender-filter"
                                >
                                    <option value="All">All Genders</option>
                                    <option value="Male">Male</option>
                                    <option value="Female">Female</option>
                                    <option value="Other">Other</option>
                                </select>
                                <div className="age-range-filter" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                    <label style={{ fontSize: '0.8rem', opacity: 0.8 }}>Age:</label>
                                    <input
                                        type="number"
                                        value={minAge}
                                        onChange={(e) => { setMinAge(e.target.value); setSugPage(1); }}
                                        placeholder="Min"
                                        style={{ width: '50px', padding: '4px', borderRadius: '4px', border: '1px solid var(--border)', background: 'var(--bg-tertiary)', color: 'inherit' }}
                                    />
                                    <span>-</span>
                                    <input
                                        type="number"
                                        value={maxAge}
                                        onChange={(e) => { setMaxAge(e.target.value); setSugPage(1); }}
                                        placeholder="Max"
                                        style={{ width: '50px', padding: '4px', borderRadius: '4px', border: '1px solid var(--border)', background: 'var(--bg-tertiary)', color: 'inherit' }}
                                    />
                                </div>
                            </div>
                        </div>

                        {suggestions.length === 0 && !loadingSuggestions ? (
                            <div className="empty-state">
                                <span className="empty-icon">🔍</span>
                                <h3>No suggestions found</h3>
                                <p>Try different filters or search by Unique ID</p>
                            </div>
                        ) : (
                            <>
                                <div className="suggestions-grid">
                                    {suggestions.map((s) => (
                                        <div key={s._id} className="suggestion-card">
                                            <div className="user-avatar-wrapper" style={{ position: 'relative' }}>
                                                <UserAvatar user={s} />
                                                <span className="age-badge" style={{ position: 'absolute', bottom: '-4px', right: '-4px', background: 'var(--accent)', color: 'white', fontSize: '0.7rem', padding: '2px 4px', borderRadius: '4px', fontWeight: 'bold' }}>{s.age}</span>
                                            </div>
                                            <div className="sug-info">
                                                <h4>{s.displayName || s.username} <GenderIcon gender={s.gender} /></h4>
                                                <span className="user-uid">ID: {s.uniqueId}</span>
                                                <div style={{ fontSize: '0.75rem', opacity: 0.7, marginTop: '2px' }}>
                                                    {s.gender === 'Male' ? '👦 Boy' : (s.gender === 'Female' ? '👧 Girl' : '👤 Other')} • {s.age} yrs
                                                </div>
                                                {s.bio && <p className="sug-bio">{s.bio}</p>}
                                            </div>
                                            {requestSent.has(s._id) ? (
                                                <span className="badge badge-sent">Sent ✓</span>
                                            ) : (
                                                <button onClick={() => sendRequest(s._id)} className="btn btn-outline btn-sm">
                                                    + Add
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                                {hasMore && (
                                    <button
                                        onClick={() => fetchSuggestions(sugPage + 1, false)}
                                        className="btn btn-ghost btn-full load-more"
                                        disabled={loadingSuggestions}
                                    >
                                        {loadingSuggestions ? 'Loading...' : 'See More →'}
                                    </button>
                                )}
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default Home;
