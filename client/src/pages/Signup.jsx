import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Signup = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [gender, setGender] = useState(''); // Start empty to force selection
    const [age, setAge] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);
    const [uniqueId, setUniqueId] = useState('');
    const { signup } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (password !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        if (!age || age < 13) {
            setError('You must be at least 13 years old');
            return;
        }

        setLoading(true);
        try {
            // Determine avatar based on gender
            const avatar = gender === 'Male'
                ? `https://api.dicebear.com/7.x/avataaars/svg?seed=Felix&mouth=smile&eyebrows=default&eyes=default`
                : (gender === 'Female' ? `https://api.dicebear.com/7.x/avataaars/svg?seed=Aria&mouth=smile&eyebrows=default&eyes=default` : '');

            const data = await signup(username, password, gender, parseInt(age), avatar);
            setUniqueId(data.user.uniqueId);
            setShowSuccess(true);
        } catch (err) {
            setError(err.response?.data?.message || 'Signup failed');
        } finally {
            setLoading(false);
        }
    };

    const copyId = () => {
        navigator.clipboard.writeText(uniqueId);
    };

    if (showSuccess) {
        return (
            <div className="auth-page">
                <div className="auth-container">
                    <div className="auth-header">
                        <div className="auth-logo success-logo">🎉</div>
                        <h1>Account Created!</h1>
                        <p>Your unique ID has been generated</p>
                    </div>

                    <div className="unique-id-card">
                        <label>Your Unique ID</label>
                        <div className="unique-id-display">
                            <span className="unique-id-text">{uniqueId}</span>
                            <button onClick={copyId} className="btn-copy" title="Copy ID">
                                📋
                            </button>
                        </div>
                        <p className="unique-id-note">
                            Share this ID with friends so they can find and add you!
                        </p>
                    </div>

                    <button onClick={() => navigate('/')} className="btn btn-primary btn-full">
                        Start Chatting →
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="auth-page">
            <div className="auth-container">
                <div className="auth-header">
                    <img src="/mateify-logo.png" alt="Mateify Logo" className="auth-logo" style={{ width: '80px', height: '80px', objectFit: 'contain' }} />
                    <h1>Create Account</h1>
                    <p>Join Mateify to find your spark</p>
                </div>

                <form onSubmit={handleSubmit} className="auth-form">
                    {error && <div className="error-alert">{error}</div>}

                    <div className="form-group">
                        <label htmlFor="username">Username</label>
                        <input
                            id="username"
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder="Choose a username"
                            required
                            minLength={3}
                            autoComplete="username"
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="password">Password</label>
                        <input
                            id="password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Minimum 6 characters"
                            required
                            minLength={6}
                            autoComplete="new-password"
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="confirmPassword">Confirm Password</label>
                        <input
                            id="confirmPassword"
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="Confirm your password"
                            required
                            autoComplete="new-password"
                        />
                    </div>

                    <div className="form-row signup-extras">
                        <div className="form-group flex-1">
                            <label>Age</label>
                            <input
                                type="number"
                                value={age}
                                onChange={(e) => setAge(e.target.value)}
                                placeholder="18"
                                required
                                min="13"
                                max="100"
                            />
                        </div>
                        <div className="form-group flex-1">
                            <label>Gender</label>
                            <div className="gender-toggle-group">
                                <button
                                    type="button"
                                    className={`gender-btn ${gender === 'Male' ? 'active' : ''}`}
                                    onClick={() => setGender('Male')}
                                >
                                    👦 Boy
                                </button>
                                <button
                                    type="button"
                                    className={`gender-btn ${gender === 'Female' ? 'active' : ''}`}
                                    onClick={() => setGender('Female')}
                                >
                                    👧 Girl
                                </button>
                            </div>
                        </div>
                    </div>

                    <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
                        {loading ? <span className="spinner"></span> : 'Create Account'}
                    </button>
                </form>

                <p className="auth-footer">
                    Already have an account? <Link to="/login">Sign In</Link>
                </p>
            </div>
        </div>
    );
};

export default Signup;
