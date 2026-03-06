import { createContext, useContext, useState, useEffect } from 'react';
import API from '../utils/api';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(localStorage.getItem('chatapp_token'));
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (token) {
            fetchUser();
        } else {
            setLoading(false);
        }
    }, [token]);

    const fetchUser = async () => {
        try {
            const { data } = await API.get('/auth/me');
            setUser(data);
        } catch (error) {
            logout();
        } finally {
            setLoading(false);
        }
    };

    const login = async (username, password) => {
        const { data } = await API.post('/auth/login', { username, password });
        localStorage.setItem('chatapp_token', data.token);
        localStorage.setItem('chatapp_user', JSON.stringify(data.user));
        setToken(data.token);
        setUser(data.user);
        return data;
    };

    const signup = async (username, password, gender, age, avatar) => {
        const { data } = await API.post('/auth/signup', { username, password, gender, age, avatar });
        localStorage.setItem('chatapp_token', data.token);
        localStorage.setItem('chatapp_user', JSON.stringify(data.user));
        setToken(data.token);
        setUser(data.user);
        return data;
    };

    const logout = () => {
        localStorage.removeItem('chatapp_token');
        localStorage.removeItem('chatapp_user');
        setToken(null);
        setUser(null);
    };

    const updateUser = (updates) => {
        setUser((prev) => ({ ...prev, ...updates }));
    };

    return (
        <AuthContext.Provider value={{ user, token, loading, login, signup, logout, updateUser, fetchUser }}>
            {children}
        </AuthContext.Provider>
    );
};
