import User from '../models/User.js';
import Message from '../models/Message.js';
import FriendRequest from '../models/FriendRequest.js';
import Conversation from '../models/Conversation.js';
import bcrypt from 'bcryptjs';

// DELETE /api/users/profile
export const deleteAccount = async (req, res) => {
    try {
        const userId = req.user._id;

        // 1. Delete all messages sent by or received by account
        await Message.deleteMany({
            $or: [{ sender: userId }, { receiver: userId }],
        });

        // 2. Delete all friend requests involving user
        await FriendRequest.deleteMany({
            $or: [{ from: userId }, { to: userId }],
        });

        // 3. Update conversations user was part of
        // We'll delete conversations where user was a participant
        // In a real app, you might want to just remove them from participants, 
        // but since this is a 1-to-1 chat app typically, deleting the conversation makes sense.
        await Conversation.deleteMany({
            participants: userId,
        });

        // 4. Remove this user from others' friends and blocked lists
        await User.updateMany(
            { $or: [{ friends: userId }, { blocked: userId }] },
            { $pull: { friends: userId, blocked: userId } }
        );

        // 5. Delete the user
        await User.findByIdAndDelete(userId);

        res.json({ message: 'Account deleted successfully' });
    } catch (error) {
        console.error('Delete account error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// GET /api/users/profile
export const getProfile = async (req, res) => {
    try {
        const user = await User.findById(req.user._id)
            .select('-password')
            .populate('friends', 'username displayName avatar uniqueId isOnline lastSeen')
            .populate('blocked', 'username displayName avatar uniqueId')
            .lean();
        res.json(user);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

// PUT /api/users/profile
export const updateProfile = async (req, res) => {
    try {
        const { displayName, bio, avatar, gender, username } = req.body;
        const updates = {};
        if (displayName !== undefined) updates.displayName = displayName;
        if (bio !== undefined) updates.bio = bio;
        if (avatar !== undefined) updates.avatar = avatar;
        if (gender !== undefined) updates.gender = gender;

        if (username !== undefined && username !== req.user.username) {
            const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
            if (!usernameRegex.test(username)) {
                return res.status(400).json({ message: 'Username must be 3-20 characters long and contain only letters, numbers, and underscores' });
            }
            const existingUser = await User.findOne({ username });
            if (existingUser && existingUser._id.toString() !== req.user._id.toString()) {
                return res.status(400).json({ message: 'Username is already taken' });
            }
            updates.username = username;
        }

        const user = await User.findByIdAndUpdate(req.user._id, updates, { new: true })
            .select('-password')
            .lean();
        res.json(user);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

// GET /api/users/search/:uniqueId
export const searchByUniqueId = async (req, res) => {
    try {
        const user = await User.findOne({ uniqueId: req.params.uniqueId })
            .select('username displayName avatar uniqueId bio gender isOnline')
            .lean();

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Don't return yourself
        if (user._id.toString() === req.user._id.toString()) {
            return res.status(400).json({ message: 'You cannot search yourself' });
        }

        const currentUser = await User.findById(req.user._id).lean();
        const isFriend = currentUser.friends.some(id => id.toString() === user._id.toString());

        const pendingRequest = await FriendRequest.findOne({
            $or: [
                { from: req.user._id, to: user._id, status: 'pending' },
                { from: user._id, to: req.user._id, status: 'pending' },
            ],
        });

        res.json({
            ...user,
            isFriend,
            isPending: !!pendingRequest,
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

// GET /api/users/suggestions?gender=Male&minAge=18&maxAge=30&page=1&limit=10
export const getSuggestions = async (req, res) => {
    try {
        const { gender, minAge, maxAge, page = 1, limit = 10 } = req.query;
        const currentUser = await User.findById(req.user._id).lean();

        const filter = {
            _id: {
                $ne: req.user._id,
                $nin: [...(currentUser.friends || []), ...(currentUser.blocked || [])],
            },
        };

        if (gender && gender !== 'All') {
            filter.gender = gender;
        }

        if (minAge || maxAge) {
            filter.age = {};
            if (minAge) filter.age.$gte = parseInt(minAge);
            if (maxAge) filter.age.$lte = parseInt(maxAge);
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const users = await User.find(filter)
            .select('username displayName avatar uniqueId bio gender age isOnline')
            .skip(skip)
            .limit(parseInt(limit))
            .lean();

        const total = await User.countDocuments(filter);

        const usersWithStatus = await Promise.all(users.map(async (u) => {
            const pendingRequest = await FriendRequest.findOne({
                $or: [
                    { from: req.user._id, to: u._id, status: 'pending' },
                    { from: u._id, to: req.user._id, status: 'pending' },
                ],
            });
            return {
                ...u,
                isFriend: false, // Suggestions already filter out friends
                isPending: !!pendingRequest,
            };
        }));

        res.json({
            users: usersWithStatus,
            total,
            page: parseInt(page),
            totalPages: Math.ceil(total / parseInt(limit)),
            hasMore: skip + users.length < total,
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

// POST /api/users/block/:userId
export const blockUser = async (req, res) => {
    try {
        const userId = req.params.userId;

        if (userId === req.user._id.toString()) {
            return res.status(400).json({ message: 'You cannot block yourself' });
        }

        // Add to blocked list and remove from friends
        await User.findByIdAndUpdate(req.user._id, {
            $addToSet: { blocked: userId },
            $pull: { friends: userId },
        });

        // Also remove from the other user's friends list
        await User.findByIdAndUpdate(userId, {
            $pull: { friends: req.user._id },
        });

        res.json({ message: 'User blocked' });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

// POST /api/users/unblock/:userId
export const unblockUser = async (req, res) => {
    try {
        await User.findByIdAndUpdate(req.user._id, {
            $pull: { blocked: req.params.userId },
        });
        res.json({ message: 'User unblocked' });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

// POST /api/users/change-password
export const changePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({ message: 'Current and new password are required' });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({ message: 'New password must be at least 6 characters' });
        }

        const user = await User.findById(req.user._id);
        const isMatch = await user.comparePassword(currentPassword);
        if (!isMatch) {
            return res.status(400).json({ message: 'Current password is incorrect' });
        }

        const salt = await bcrypt.genSalt(12);
        user.password = await bcrypt.hash(newPassword, salt);
        // Mark password as modified to skip pre('save') rehash
        user.$locals.skipPasswordHash = true;
        await User.findByIdAndUpdate(user._id, { password: user.password });

        res.json({ message: 'Password changed successfully' });
    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// POST /api/users/toggle-status
export const toggleOnlineStatus = async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        const newHiddenStatus = !user.isHidden;
        await User.findByIdAndUpdate(req.user._id, { isHidden: newHiddenStatus });

        // Broadcast the change if there's a connected socket instance
        if (req.app.get('io') && req.app.get('onlineUsers')) {
            const io = req.app.get('io');
            const onlineUsers = req.app.get('onlineUsers');
            const userId = req.user._id.toString();

            // Re-fetch friends and conversations logic (simplified from socket)
            const userDoc = await User.findById(userId).select('friends').lean();
            const friends = (userDoc?.friends || []).map(f => f.toString());
            const conversations = await Conversation.find({ participants: userId }).select('participants').lean();
            const conversationParticipants = conversations.flatMap(conv => conv.participants.map(p => p.toString()));
            const participantIds = new Set([...friends, ...conversationParticipants].filter(pId => pId !== userId));

            participantIds.forEach((pId) => {
                if (!newHiddenStatus) { // Not hidden -> Visible
                    if (onlineUsers.has(userId)) {
                        io.to(`user_${pId}`).emit('userOnline', userId);
                    }
                } else { // Hidden -> Offline
                    io.to(`user_${pId}`).emit('userOffline', { userId, lastSeen: new Date() });
                }
            });

            // Also notify the active user's socket that they changed status (if they have other tabs open)
            io.to(`user_${userId}`).emit('statusToggled', newHiddenStatus);
        }

        res.json({ isHidden: newHiddenStatus, user: { ...user.toObject(), isHidden: newHiddenStatus } });
    } catch (error) {
        console.error('Toggle status error', error);
        res.status(500).json({ message: 'Server error' });
    }
};
