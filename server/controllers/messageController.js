import Message from '../models/Message.js';
import Conversation from '../models/Conversation.js';
import User from '../models/User.js';

// GET /api/messages/:conversationId
export const getMessages = async (req, res) => {
    try {
        const { conversationId } = req.params;
        const { cursor, limit = 50 } = req.query;

        const conversation = await Conversation.findById(conversationId);
        if (!conversation) {
            return res.status(404).json({ message: 'Conversation not found' });
        }

        // Verify user is a participant
        if (!conversation.participants.includes(req.user._id)) {
            return res.status(403).json({ message: 'Not authorized' });
        }

        const query = {
            conversationId,
            deletedFor: { $ne: req.user._id },
        };

        if (cursor) {
            query.createdAt = { $lt: new Date(cursor) };
        }

        const messages = await Message.find(query)
            .sort({ createdAt: -1 })
            .limit(parseInt(limit))
            .populate('sender', 'username displayName avatar')
            .populate({ path: 'replyTo', select: 'text sender', populate: { path: 'sender', select: 'username displayName' } })
            .lean();

        res.json({
            messages: messages.reverse(),
            hasMore: messages.length === parseInt(limit),
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

// GET /api/messages/conv/:conversationId
export const getConversationById = async (req, res) => {
    try {
        const { conversationId } = req.params;
        const conversation = await Conversation.findById(conversationId)
            .populate('participants', 'username displayName avatar uniqueId isOnline lastSeen');

        if (!conversation) {
            return res.status(404).json({ message: 'Conversation not found' });
        }

        // Verify user is a participant
        if (!conversation.participants.some(p => p._id.toString() === req.user._id.toString())) {
            return res.status(403).json({ message: 'Not authorized' });
        }

        res.json(conversation);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

// GET /api/conversations
export const getConversations = async (req, res) => {
    try {
        const currentUser = await User.findById(req.user._id).select('blocked').lean();
        const blockedIds = (currentUser.blocked || []).map(id => id.toString());

        const conversations = await Conversation.find({
            participants: req.user._id,
        })
            .populate('participants', 'username displayName avatar uniqueId isOnline lastSeen')
            .populate('lastMessage')
            .sort('-updatedAt')
            .lean();

        // Filter out conversations with blocked users
        const filtered = conversations.filter(conv => {
            const other = conv.participants.find(p => p._id.toString() !== req.user._id.toString());
            return other && !blockedIds.includes(other._id.toString());
        });

        // Add unread count for each conversation from the optimized map
        const withUnread = filtered.map(conv => {
            const unreadCount = conv.unreadCounts ? (conv.unreadCounts[req.user._id.toString()] || 0) : 0;
            return {
                ...conv,
                unreadCount
            };
        });

        res.json(withUnread);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

// GET /api/messages/conversation/:userId
export const getOrCreateConversation = async (req, res) => {
    try {
        const { userId } = req.params;

        let conversation = await Conversation.findOne({
            participants: { $all: [req.user._id, userId] },
        })
            .populate('participants', 'username displayName avatar uniqueId isOnline lastSeen')
            .populate('lastMessage');

        if (!conversation) {
            conversation = await Conversation.create({
                participants: [req.user._id, userId],
            });
            conversation = await conversation.populate('participants', 'username displayName avatar uniqueId isOnline lastSeen');
        }

        res.json(conversation);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};
