import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import API from '../utils/api';

const GenderIcon = ({ gender }) => {
    if (gender === 'Male') return <span className="gender-label male" title="Male">👦 Boy</span>;
    if (gender === 'Female') return <span className="gender-label female" title="Female">👧 Girl</span>;
    return null;
};

const Profile = () => {
    const { user, updateUser, logout } = useAuth();
    const [displayName, setDisplayName] = useState('');
    const [username, setUsername] = useState('');
    const [bio, setBio] = useState('');
    const [gender, setGender] = useState('');
    const [avatar, setAvatar] = useState('');
    const [editing, setEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [uploadingAvatar, setUploadingAvatar] = useState(false);
    const fileInputRef = React.useRef(null);
    const [copied, setCopied] = useState(false);
    const [blocked, setBlocked] = useState([]);
    // Change password
    const [showPwdForm, setShowPwdForm] = useState(false);
    const [currentPwd, setCurrentPwd] = useState('');
    const [newPwd, setNewPwd] = useState('');
    const [confirmPwd, setConfirmPwd] = useState('');
    const [pwdMsg, setPwdMsg] = useState({ text: '', type: '' });
    const [savingPwd, setSavingPwd] = useState(false);

    const handleDeleteAccount = async () => {
        if (window.confirm('Are you sure you want to PERMANENTLY delete your account? This cannot be undone.')) {
            try {
                await API.delete('/users/profile');
                alert('Your account has been deleted.');
                logout();
            } catch (err) {
                alert('Failed to delete account');
            }
        }
    };

    useEffect(() => {
        if (user) {
            setDisplayName(user.displayName || '');
            setUsername(user.username || '');
            setBio(user.bio || '');
            setGender(user.gender || '');
            setAvatar(user.avatar || '');
            fetchProfile();
        }
    }, [user]);

    const fetchProfile = async () => {
        try {
            const { data } = await API.get('/users/profile');
            setBlocked(data.blocked || []);
        } catch (err) {
            console.error(err);
        }
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            const { data } = await API.put('/users/profile', { displayName, username, bio, gender, avatar });
            updateUser(data);
            setEditing(false);
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to update profile');
        } finally {
            setSaving(false);
        }
    };

    const handleAvatarUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setUploadingAvatar(true);
        try {
            const formData = new FormData();
            formData.append('avatar', file);
            const { data } = await API.post('/upload/avatar', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            setAvatar(data.url);
        } catch (err) {
            alert('Failed to upload avatar');
        } finally {
            setUploadingAvatar(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const copyId = () => {
        navigator.clipboard.writeText(user.uniqueId);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleUnblock = async (userId) => {
        try {
            await API.post(`/users/unblock/${userId}`);
            setBlocked((prev) => prev.filter((u) => u._id !== userId));
        } catch (err) {
            alert('Failed to unblock');
        }
    };

    const handleChangePassword = async (e) => {
        e.preventDefault();
        setPwdMsg({ text: '', type: '' });
        if (newPwd !== confirmPwd) {
            setPwdMsg({ text: 'New passwords do not match', type: 'error' });
            return;
        }
        if (newPwd.length < 6) {
            setPwdMsg({ text: 'Password must be at least 6 characters', type: 'error' });
            return;
        }
        setSavingPwd(true);
        try {
            await API.post('/users/change-password', { currentPassword: currentPwd, newPassword: newPwd });
            setPwdMsg({ text: '✅ Password changed successfully!', type: 'success' });
            setCurrentPwd(''); setNewPwd(''); setConfirmPwd('');
            setTimeout(() => { setShowPwdForm(false); setPwdMsg({ text: '', type: '' }); }, 2000);
        } catch (err) {
            setPwdMsg({ text: err.response?.data?.message || 'Failed to change password', type: 'error' });
        } finally {
            setSavingPwd(false);
        }
    };

    const handleToggleStatus = async () => {
        try {
            const { data } = await API.post('/users/toggle-status');
            updateUser(data.user);
        } catch (err) {
            alert('Failed to update status');
        }
    };

    if (!user) return null;

    return (
        <div className="profile-page">
            <div className="profile-card">
                {/* Avatar */}
                <div className="profile-avatar-section">
                    <div className="user-avatar xl profile-avatar-edit">
                        {(editing ? avatar : user.avatar) ? (
                            <img src={editing ? avatar : user.avatar} alt="Profile" />
                        ) : user.gender === 'Male' ? (
                            <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Felix&mouth=smile&eyebrows=default&eyes=default" alt="Profile" />
                        ) : user.gender === 'Female' ? (
                            <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Aria&mouth=smile&eyebrows=default&eyes=default" alt="Profile" />
                        ) : (
                            <div className="letter-avatar">{(user.displayName || user.username)?.[0]?.toUpperCase() || '?'}</div>
                        )}
                        {editing && (
                            <div className="avatar-upload-overlay" onClick={() => fileInputRef.current?.click()}>
                                {uploadingAvatar ? <span className="spinner sm"></span> : '📷'}
                            </div>
                        )}
                        <input type="file" ref={fileInputRef} style={{ display: 'none' }} accept="image/*" onChange={handleAvatarUpload} />
                    </div>
                    <h2>{user.displayName || user.username} <GenderIcon gender={user.gender} /></h2>
                    <p className="profile-username">@{user.username}</p>
                </div>

                {/* Status Toggle & Unique ID */}
                <div className="unique-id-card">
                    <div className="status-toggle-section" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--border)', paddingBottom: '16px' }}>
                        <div>
                            <h4 style={{ margin: 0 }}>Online Status</h4>
                            <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Show others when you are active</p>
                        </div>
                        <button
                            className={`btn ${!user.isHidden ? 'btn-primary' : 'btn-secondary'}`}
                            style={{ borderRadius: '20px', padding: '6px 16px' }}
                            onClick={handleToggleStatus}
                        >
                            {!user.isHidden ? '👁️ Visible' : '👻 Hidden'}
                        </button>
                    </div>

                    <label>Your Unique ID</label>
                    <div className="unique-id-display">
                        <span className="unique-id-text">{user.uniqueId}</span>
                        <button onClick={copyId} className="btn-copy" title="Copy ID">
                            {copied ? '✅' : '📋'}
                        </button>
                    </div>
                </div>

                {/* Profile Form */}
                {editing ? (
                    <form onSubmit={handleSave} className="profile-form">
                        <div className="form-group">
                            <label>Display Name</label>
                            <input
                                type="text"
                                value={displayName}
                                onChange={(e) => setDisplayName(e.target.value)}
                                placeholder="Your display name"
                            />
                        </div>

                        <div className="form-group">
                            <label>Username (Unique)</label>
                            <input
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
                                placeholder="Your username"
                                required
                                minLength={3}
                                maxLength={20}
                            />
                        </div>

                        <div className="form-group">
                            <label>Bio</label>
                            <textarea
                                value={bio}
                                onChange={(e) => setBio(e.target.value)}
                                placeholder="Write something about yourself..."
                                maxLength={200}
                                rows={3}
                            />
                            <small>{bio.length}/200</small>
                        </div>

                        <div className="form-group">
                            <label>Gender</label>
                            <select
                                value={gender}
                                onChange={(e) => {
                                    const newGender = e.target.value;
                                    setGender(newGender);
                                    // Auto-update avatar only if it's currently a default Dicebear one or empty
                                    if (!avatar || avatar.includes('api.dicebear.com')) {
                                        if (newGender === 'Male') {
                                            setAvatar(`https://api.dicebear.com/7.x/avataaars/svg?seed=Felix&mouth=smile&eyebrows=default&eyes=default`);
                                        } else if (newGender === 'Female') {
                                            setAvatar(`https://api.dicebear.com/7.x/avataaars/svg?seed=Aria&mouth=smile&eyebrows=default&eyes=default`);
                                        } else {
                                            setAvatar('');
                                        }
                                    }
                                }}
                            >
                                <option value="">Prefer not to say</option>
                                <option value="Male">Male</option>
                                <option value="Female">Female</option>
                                <option value="Other">Other</option>
                            </select>
                        </div>

                        <div className="profile-actions">
                            <button type="submit" className="btn btn-primary" disabled={saving}>
                                {saving ? 'Saving...' : 'Save Changes'}
                            </button>
                            <button type="button" className="btn btn-ghost" onClick={() => setEditing(false)}>
                                Cancel
                            </button>
                        </div>
                    </form>
                ) : (
                    <div className="profile-details">
                        <div className="detail-item">
                            <label>Bio</label>
                            <p>{user.bio || 'No bio yet'}</p>
                        </div>
                        <div className="detail-item">
                            <label>Age</label>
                            <p>{user.age} yrs</p>
                        </div>
                        <div className="detail-item">
                            <label>Gender</label>
                            <p>{user.gender || 'Not specified'}</p>
                        </div>
                        <button className="btn btn-outline btn-full" onClick={() => setEditing(true)}>
                            ✏️ Edit Profile
                        </button>
                    </div>
                )}

                {/* Blocked Users */}
                {blocked.length > 0 && (
                    <div className="blocked-section">
                        <h3>Blocked Users</h3>
                        {blocked.map((b) => (
                            <div key={b._id} className="blocked-item">
                                <span>{b.displayName || b.username}</span>
                                <button onClick={() => handleUnblock(b._id)} className="btn btn-sm btn-ghost">
                                    Unblock
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                {/* Change Password */}
                <div style={{ marginTop: '24px', borderTop: '1px solid var(--border)', paddingTop: '20px' }}>
                    <button
                        className="btn btn-outline btn-full"
                        onClick={() => { setShowPwdForm(p => !p); setPwdMsg({ text: '', type: '' }); }}
                        style={{ marginBottom: showPwdForm ? '16px' : '0' }}
                    >
                        🔑 {showPwdForm ? 'Cancel' : 'Change Password'}
                    </button>
                    {showPwdForm && (
                        <form onSubmit={handleChangePassword} className="profile-form" style={{ marginTop: '16px' }}>
                            <div className="form-group">
                                <label>Current Password</label>
                                <input type="password" value={currentPwd} onChange={e => setCurrentPwd(e.target.value)} placeholder="Enter current password" required />
                            </div>
                            <div className="form-group">
                                <label>New Password</label>
                                <input type="password" value={newPwd} onChange={e => setNewPwd(e.target.value)} placeholder="Min 6 characters" required />
                            </div>
                            <div className="form-group">
                                <label>Confirm New Password</label>
                                <input type="password" value={confirmPwd} onChange={e => setConfirmPwd(e.target.value)} placeholder="Repeat new password" required />
                            </div>
                            {pwdMsg.text && (
                                <p style={{ color: pwdMsg.type === 'error' ? 'var(--danger)' : 'var(--success)', fontSize: '0.85rem', margin: '4px 0' }}>{pwdMsg.text}</p>
                            )}
                            <button type="submit" className="btn btn-primary" disabled={savingPwd}>
                                {savingPwd ? 'Saving...' : 'Update Password'}
                            </button>
                        </form>
                    )}
                </div>

                <div className="danger-zone" style={{ marginTop: '32px', borderTop: '1px solid var(--border)', paddingTop: '24px' }}>
                    <button
                        onClick={handleDeleteAccount}
                        className="btn btn-ghost danger btn-full"
                        style={{ color: 'var(--danger)', fontWeight: '600' }}
                    >
                        🗑️ Delete Account
                    </button>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', textAlign: 'center', marginTop: '8px' }}>
                        Warning: This action is permanent and will delete all your data.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default Profile;
