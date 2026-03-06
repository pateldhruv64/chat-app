import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import connectDB from './config/db.js';
import { connectRedis } from './config/redis.js';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/user.js';
import friendRoutes from './routes/friends.js';
import messageRoutes from './routes/messages.js';
import uploadRoutes from './routes/upload.js';
import { setupSocket } from './socket/index.js';
import User from './models/User.js';

const app = express();
const server = createServer(app);
const allowedOrigins = [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:4173'
];
if (process.env.CLIENT_URL) {
    allowedOrigins.push(process.env.CLIENT_URL);
}

const io = new Server(server, {
    cors: {
        origin: allowedOrigins,
        methods: ['GET', 'POST', 'PUT', 'DELETE'],
        credentials: true,
    },
});

// Middleware
app.use(cors({
    origin: allowedOrigins,
    credentials: true,
}));
app.use(express.json());

// Make io accessible to routes
app.set('io', io);

// Routes
import rateLimit from 'express-rate-limit';

const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 500,
    message: { message: "Too many requests from this IP, please try again after 15 minutes" }
});

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 50,
    message: { message: "Too many login attempts from this IP, please try again after 15 minutes" }
});

app.use(globalLimiter);
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/friends', friendRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/upload', uploadRoutes);

app.get('/', (req, res) => {
    res.json({ message: 'ChatApp API is running' });
});

// Socket.io
setupSocket(io, app);

// Connect DB & Start Server
const PORT = process.env.PORT || 5000;

Promise.all([connectDB(), connectRedis()]).then(async () => {
    // Reset all users Online status on server start
    try {
        await User.updateMany({}, { isOnline: false });
        console.log('All users reset to offline on startup');
    } catch (err) {
        console.error('Error resetting online status:', err);
    }

    server.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
});

export { io };
