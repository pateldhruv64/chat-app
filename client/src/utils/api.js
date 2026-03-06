import axios from 'axios';

let baseApiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
baseApiUrl = baseApiUrl.replace(/\/+$/, ''); // Strip any trailing slashes
if (!baseApiUrl.endsWith('/api') && !baseApiUrl.includes('localhost:5000/api')) {
    baseApiUrl += '/api'; // Append /api cleanly
}

const API = axios.create({
    baseURL: baseApiUrl,
});

// Attach JWT token to every request
API.interceptors.request.use((config) => {
    const token = localStorage.getItem('chatapp_token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// Handle 401 responses
API.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            localStorage.removeItem('chatapp_token');
            localStorage.removeItem('chatapp_user');
            window.location.href = '/login';
        }
        return Promise.reject(error);
    }
);

export default API;
