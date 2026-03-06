import FriendRequest from '../models/FriendRequest.js';
import User from '../models/User.js';
import Conversation from '../models/Conversation.js';
import Message from '../models/Message.js';
import mongoose from 'mongoose';

// POST /api/friends/request/:userId
export const sendFriendRequest = async (req, res) => {
    try {
        const { userId } = req.params;
        const fromId = req.user._id;

        if (userId === fromId.toString()) {
            return res.status(400).json({ message: 'Cannot send request to yourself' });
        }

        // Check if target user exists
        const targetUser = await User.findById(userId);
        if (!targetUser) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Check if blocked
        const currentUser = await User.findById(fromId);
        if (currentUser.blocked.some(id => id.toString() === userId) ||
            targetUser.blocked.some(id => id.toString() === fromId.toString())) {
            return res.status(400).json({ message: 'Cannot send request to this user' });
        }

        // Check if already friends
        if (currentUser.friends.some(id => id.toString() === userId)) {
            return res.status(400).json({ message: 'Already friends' });
        }

        // Check if request already exists
        const existingRequest = await FriendRequest.findOne({
            $or: [
                { from: fromId, to: userId, status: 'pending' },
                { from: userId, to: fromId, status: 'pending' },
            ],
        });

        if (existingRequest) {
            return res.status(400).json({ message: 'Friend request already exists' });
        }

        const request = await FriendRequest.create({ from: fromId, to: userId });
        const populated = await request.populate('from', 'username displayName avatar uniqueId');

        // Emit socket event to the receiver
        const io = req.app.get('io');
        if (io) {
            io.to(`user_${userId}`).emit('friendRequestReceived', populated);
        }

        res.status(201).json(populated);
    } catch (error) {
        console.error('Send friend request error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// PUT /api/friends/accept/:requestId
export const acceptFriendRequest = async (req, res) => {
    try {
        const request = await FriendRequest.findById(req.params.requestId);

        if (!request) {
            return res.status(404).json({ message: 'Request not found' });
        }

        if (request.to.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Not authorized' });
        }

        if (request.status !== 'pending') {
            return res.status(400).json({ message: 'Request already processed' });
        }

        request.status = 'accepted';
        await request.save();

        // Add each other as friends
        await User.findByIdAndUpdate(request.from, { $addToSet: { friends: request.to } });
        await User.findByIdAndUpdate(request.to, { $addToSet: { friends: request.from } });

        // Create conversation
        let conversation = await Conversation.findOne({
            participants: { $all: [request.from, request.to] },
        });

        if (!conversation) {
            conversation = await Conversation.create({
                participants: [request.from, request.to],
            });
        }

        // Emit socket events
        const io = req.app.get('io');
        if (io) {
            // Notify the sender that it was accepted
            io.to(`user_${request.from.toString()}`).emit('friendRequestAccepted', {
                requestId: request._id,
                user: req.user,
                conversationId: conversation._id,
            });
            // Notify the receiver (current user) so they can update their own UI/badge
            io.to(`user_${req.user._id.toString()}`).emit('friendRequestAccepted', {
                requestId: request._id,
                conversationId: conversation._id,
            });
        }

        res.json({ message: 'Friend request accepted', conversationId: conversation._id });
    } catch (error) {
        console.error('Accept friend request error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// PUT /api/friends/reject/:requestId
export const rejectFriendRequest = async (req, res) => {
    try {
        const request = await FriendRequest.findById(req.params.requestId);

        if (!request) {
            return res.status(404).json({ message: 'Request not found' });
        }

        if (request.to.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Not authorized' });
        }

        request.status = 'rejected';
        await request.save();

        // Emit socket event to the receiver (current user) to update badge
        const io = req.app.get('io');
        if (io) {
            io.to(`user_${req.user._id.toString()}`).emit('friendRequestRejected', {
                requestId: request._id
            });
        }

        res.json({ message: 'Friend request rejected' });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

// GET /api/friends/requests
export const getRequests = async (req, res) => {
    try {
        const incoming = await FriendRequest.find({ to: req.user._id, status: 'pending' })
            .populate('from', 'username displayName avatar uniqueId')
            .sort('-createdAt')
            .lean();

        const outgoing = await FriendRequest.find({ from: req.user._id, status: 'pending' })
            .populate('to', 'username displayName avatar uniqueId')
            .sort('-createdAt')
            .lean();

        res.json({ incoming, outgoing });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

// GET /api/friends/list
export const getFriendsList = async (req, res) => {
    try {
        const user = await User.findById(req.user._id)
            .populate('friends', 'username displayName avatar uniqueId isOnline lastSeen bio')
            .lean();
        res.json(user.friends || []);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

// DELETE /api/friends/remove/:userId
export const removeFriend = async (req, res) => {
    try {
        const { userId } = req.params;
        const currentUserId = req.user._id;
        const friendId = new mongoose.Types.ObjectId(userId);

        // Remove from both users' friends lists
        await User.findByIdAndUpdate(currentUserId, { $pull: { friends: friendId } });
        await User.findByIdAndUpdate(friendId, { $pull: { friends: currentUserId } });

        // Delete any friend requests between these two users
        await FriendRequest.deleteMany({
            $or: [
                { from: currentUserId, to: friendId },
                { from: friendId, to: currentUserId },
            ],
        });

        // Delete the conversation between these two users
        const conversation = await Conversation.findOneAndDelete({
            participants: { $all: [currentUserId, friendId] },
        });

        if (conversation) {
            // Optionally delete all messages in that conversation
            await Message.deleteMany({ conversationId: conversation._id });
        }

        res.json({ message: 'Friend removed successfully' });
    } catch (error) {
        console.error('Remove friend error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
