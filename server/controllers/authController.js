import jwt from 'jsonwebtoken';
import User from '../models/User.js';

// Generate JWT
const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '30d' });
};

// POST /api/auth/signup
export const signup = async (req, res) => {
    try {
        const { username, password, gender, age, avatar } = req.body;

        if (!username || !password || !age || !gender) {
            return res.status(400).json({ message: 'Username, password, age, and gender are required' });
        }

        if (username.length < 3) {
            return res.status(400).json({ message: 'Username must be at least 3 characters' });
        }

        if (password.length < 6) {
            return res.status(400).json({ message: 'Password must be at least 6 characters' });
        }

        if (age < 13) {
            return res.status(400).json({ message: 'You must be at least 13 years old' });
        }

        const existingUser = await User.findOne({ username: username.toLowerCase() });
        if (existingUser) {
            return res.status(400).json({ message: 'Username already taken' });
        }

        const user = await User.create({
            username: username.toLowerCase(),
            password,
            displayName: username,
            gender: gender || '',
            age,
            avatar: avatar || '',
        });

        const token = generateToken(user._id);

        res.status(201).json({
            token,
            user: {
                _id: user._id,
                username: user.username,
                uniqueId: user.uniqueId,
                displayName: user.displayName,
                bio: user.bio,
                avatar: user.avatar,
                gender: user.gender,
                age: user.age,
                isHidden: user.isHidden,
            },
        });
    } catch (error) {
        console.error('Signup error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// POST /api/auth/login
export const login = async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ message: 'Username and password are required' });
        }

        const user = await User.findOne({ username: username.toLowerCase() });
        if (!user) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        const token = generateToken(user._id);

        res.json({
            token,
            user: {
                _id: user._id,
                username: user.username,
                uniqueId: user.uniqueId,
                displayName: user.displayName,
                bio: user.bio,
                avatar: user.avatar,
                gender: user.gender,
                age: user.age,
                friends: user.friends,
                isHidden: user.isHidden,
            },
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// GET /api/auth/me
export const getMe = async (req, res) => {
    try {
        const user = await User.findById(req.user._id)
            .select('-password')
            .populate('friends', 'username displayName avatar uniqueId isOnline lastSeen')
            .lean();

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.json(user);
    } catch (error) {
        console.error('GetMe error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
