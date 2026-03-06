import { useState, useEffect } from 'react';
import { useSocket } from '../context/SocketContext';
import API from '../utils/api';

const GenderIcon = ({ gender }) => {
    if (gender === 'Male') return <span className="gender-label male" title="Male">👦 Boy</span>;
    if (gender === 'Female') return <span className="gender-label female" title="Female">👧 Girl</span>;
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

const FriendRequests = () => {
    const { socket } = useSocket();
    const [incoming, setIncoming] = useState([]);
    const [outgoing, setOutgoing] = useState([]);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState('incoming');

    useEffect(() => {
        fetchRequests();
    }, []);

    // Listen for real-time friend requests
    useEffect(() => {
        if (!socket) return;

        const handleNewRequest = (request) => {
            setIncoming((prev) => [request, ...prev]);
        };

        socket.on('friendRequestReceived', handleNewRequest);
        return () => socket.off('friendRequestReceived', handleNewRequest);
    }, [socket]);

    const fetchRequests = async () => {
        try {
            const { data } = await API.get('/friends/requests');
            setIncoming(data.incoming);
            setOutgoing(data.outgoing);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleAccept = async (requestId) => {
        try {
            await API.put(`/friends/accept/${requestId}`);
            setIncoming((prev) => prev.filter((r) => r._id !== requestId));
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to accept');
        }
    };

    const handleReject = async (requestId) => {
        try {
            await API.put(`/friends/reject/${requestId}`);
            setIncoming((prev) => prev.filter((r) => r._id !== requestId));
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to reject');
        }
    };

    if (loading) {
        return (
            <div className="loading-center"><span className="spinner lg"></span></div>
        );
    }

    return (
        <div className="requests-page">
            <h2>Friend Requests</h2>

            <div className="home-tabs">
                <button className={`tab-btn ${tab === 'incoming' ? 'active' : ''}`} onClick={() => setTab('incoming')}>
                    📥 Incoming {incoming.length > 0 && <span className="tab-count">{incoming.length}</span>}
                </button>
                <button className={`tab-btn ${tab === 'outgoing' ? 'active' : ''}`} onClick={() => setTab('outgoing')}>
                    📤 Sent {outgoing.length > 0 && <span className="tab-count">{outgoing.length}</span>}
                </button>
            </div>

            {tab === 'incoming' && (
                <div className="requests-list">
                    {incoming.length === 0 ? (
                        <div className="empty-state">
                            <span className="empty-icon">📭</span>
                            <h3>No incoming requests</h3>
                        </div>
                    ) : (
                        incoming.map((req) => (
                            <div key={req._id} className="request-card">
                                <UserAvatar user={req.from} />
                                <div className="request-info">
                                    <h4>{req.from?.displayName || req.from?.username} <GenderIcon gender={req.from?.gender} /></h4>
                                    <span className="user-uid">ID: {req.from?.uniqueId}</span>
                                </div>
                                <div className="request-actions">
                                    <button onClick={() => handleAccept(req._id)} className="btn btn-primary btn-sm">
                                        Accept
                                    </button>
                                    <button onClick={() => handleReject(req._id)} className="btn btn-ghost btn-sm">
                                        Reject
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}

            {tab === 'outgoing' && (
                <div className="requests-list">
                    {outgoing.length === 0 ? (
                        <div className="empty-state">
                            <span className="empty-icon">📬</span>
                            <h3>No sent requests</h3>
                        </div>
                    ) : (
                        outgoing.map((req) => (
                            <div key={req._id} className="request-card">
                                <UserAvatar user={req.to} />
                                <div className="request-info">
                                    <h4>{req.to?.displayName || req.to?.username} <GenderIcon gender={req.to?.gender} /></h4>
                                    <span className="user-uid">ID: {req.to?.uniqueId}</span>
                                </div>
                                <span className="badge badge-pending">Pending</span>
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    );
};

export default FriendRequests;
