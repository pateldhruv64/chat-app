import jwt from 'jsonwebtoken';
import { createAdapter } from '@socket.io/redis-adapter';
import redisClient from '../config/redis.js';
import User from '../models/User.js';
import Message from '../models/Message.js';
import Conversation from '../models/Conversation.js';

export const setupSocket = (io, app) => {
    // Setup Redis Adapter for clustering
    if (redisClient.isOpen) {
        const pubClient = redisClient.duplicate();
        const subClient = redisClient.duplicate();

        Promise.all([pubClient.connect(), subClient.connect()]).then(() => {
            io.adapter(createAdapter(pubClient, subClient));
            console.log('Redis adapter hooked up for Socket.io');
        });
    }

    // Expose io to Express app for use in controllers
    if (app) {
        app.set('io', io);
    }

    // Auth middleware for socket
    io.use(async (socket, next) => {
        try {
            const token = socket.handshake.auth.token;
            if (!token) {
                return next(new Error('Authentication error'));
            }
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const user = await User.findById(decoded.id).select('-password').lean();
            if (!user) {
                return next(new Error('User not found'));
            }
            socket.userId = user._id.toString();
            socket.user = user;
            next();
        } catch (error) {
            next(new Error('Authentication error'));
        }
    });

    io.on('connection', async (socket) => {
        const userId = socket.userId;

        // Join personal room
        socket.join(`user_${userId}`);

        // Track online status in Redis Set (key: active_sockets:{userId})
        await redisClient.sAdd(`active_sockets:${userId}`, socket.id);

        // Set user socket connection flag
        await User.findByIdAndUpdate(userId, { isOnline: true });

        // We read it from the decoded token's actual DB state.
        const dbUser = await User.findById(userId);
        const isVisible = dbUser ? !dbUser.isHidden : true;

        // Notify friends and conversation participants about online status
        const fetchParticipants = async () => {
            const userDoc = await User.findById(userId).select('friends').lean();
            const friends = (userDoc?.friends || []).map(f => f.toString());

            const conversations = await Conversation.find({ participants: userId }).select('participants').lean();
            const conversationParticipants = conversations.flatMap(conv =>
                conv.participants.map(p => p.toString())
            );

            return new Set([...friends, ...conversationParticipants].filter(pId => pId !== userId));
        };

        const notifyOnlineStatus = async () => {
            const participantIds = await fetchParticipants();

            if (isVisible) {
                participantIds.forEach((pId) => {
                    io.to(`user_${pId}`).emit('userOnline', userId);
                });
            }

            // Tell THIS user which of their chat partners are already online AND visible
            const activeIds = [];
            for (const pId of participantIds) {
                const count = await redisClient.sCard(`active_sockets:${pId}`);
                if (count > 0) activeIds.push(pId);
            }

            if (activeIds.length > 0) {
                const visibleDocs = await User.find({
                    _id: { $in: activeIds },
                    isHidden: { $ne: true } // Handles case where field is missing in old documents
                }).select('_id');

                const visibleOnlineIds = visibleDocs.map(d => d._id.toString());
                if (visibleOnlineIds.length > 0) {
                    socket.emit('friendsOnlineStatus', visibleOnlineIds);
                }
            }
        };

        // Small delay to ensure DB write (isOnline=true) has fully completed 
        // before we query participants and send out the statuses.
        setTimeout(() => {
            notifyOnlineStatus();
        }, 500);

        // Deliver pending messages
        const pendingMessages = await Message.find({
            receiver: userId,
            status: 'sent',
        });

        for (const msg of pendingMessages) {
            msg.status = 'delivered';
            await msg.save();
            io.to(`user_${msg.sender.toString()}`).emit('messageStatusUpdate', {
                messageId: msg._id,
                status: 'delivered',
            });
        }

        // Join conversation rooms
        socket.on('joinConversation', (conversationId) => {
            socket.join(`conv_${conversationId}`);
        });

        socket.on('leaveConversation', (conversationId) => {
            socket.leave(`conv_${conversationId}`);
        });

        // Send message
        socket.on('sendMessage', async (data) => {
            try {
                // Rate Limiting Logic (Anti-Spam)
                if (!socket.rateLimit) {
                    socket.rateLimit = { count: 1, firstMessageTime: Date.now() };
                } else {
                    const now = Date.now();
                    if (now - socket.rateLimit.firstMessageTime > 5000) {
                        socket.rateLimit = { count: 1, firstMessageTime: now };
                    } else {
                        socket.rateLimit.count++;
                        if (socket.rateLimit.count > 10) {
                            return socket.emit('error', { message: 'You are sending messages too fast! Please wait a moment.' });
                        }
                    }
                }

                const { conversationId, receiverId, text, replyTo, imageUrl } = data;

                const hasText = text && text.trim().length > 0;
                const hasImage = imageUrl && imageUrl.trim().length > 0;

                if (!hasText && !hasImage) return;

                // Sanitize text
                const sanitized = hasText ? text.trim().replace(/<[^>]*>/g, '').substring(0, 2000) : '';

                // Check if blocked
                const receiver = await User.findById(receiverId).lean();
                if (!receiver) return;

                if (receiver.blocked && receiver.blocked.some(id => id.toString() === userId)) {
                    return socket.emit('error', { message: 'You are blocked by this user' });
                }

                const receiverCount = await redisClient.sCard(`active_sockets:${receiverId}`);
                const isDelivered = receiverCount > 0;

                const message = await Message.create({
                    sender: userId,
                    receiver: receiverId,
                    conversationId,
                    text: sanitized,
                    imageUrl: hasImage ? imageUrl : '',
                    type: hasImage ? 'image' : 'text',
                    status: isDelivered ? 'delivered' : 'sent',
                    replyTo: replyTo || null,
                });

                // Update conversation & set unreadCounts Map
                await Conversation.findByIdAndUpdate(conversationId, {
                    lastMessage: message._id,
                    updatedAt: new Date(),
                    $inc: { [`unreadCounts.${receiverId}`]: 1 }
                });

                const populated = await Message.findById(message._id).populate([
                    { path: 'sender', select: 'username displayName avatar' },
                    { path: 'replyTo', select: 'text sender imageUrl', populate: { path: 'sender', select: 'username displayName' } },
                ]).lean();

                const serializedMessage = JSON.parse(JSON.stringify(populated));

                io.to(`conv_${conversationId}`).emit('newMessage', serializedMessage);
                io.to(`user_${receiverId}`).emit('messageNotification', { message: serializedMessage, conversationId });

                if (isDelivered) {
                    io.to(`user_${userId}`).emit('messageStatusUpdate', {
                        messageId: message._id,
                        status: 'delivered',
                    });
                }
            } catch (error) {
                console.error('SERVER [sendMessage] EXCEPTION:', error);
            }
        });

        // Pin / Unpin message
        socket.on('pinMessage', async ({ messageId, conversationId }) => {
            try {
                await Message.findByIdAndUpdate(messageId, { isPinned: true });
                io.to(`conv_${conversationId}`).emit('messagePinned', { messageId, isPinned: true });
            } catch (err) { console.error('Pin error:', err); }
        });

        socket.on('unpinMessage', async ({ messageId, conversationId }) => {
            try {
                await Message.findByIdAndUpdate(messageId, { isPinned: false });
                io.to(`conv_${conversationId}`).emit('messagePinned', { messageId, isPinned: false });
            } catch (err) { console.error('Unpin error:', err); }
        });

        // Forward message
        socket.on('forwardMessage', async ({ messageId, targetConversationId, receiverId }) => {
            try {
                const original = await Message.findById(messageId);
                if (!original) return;

                const receiverCount = await redisClient.sCard(`active_sockets:${receiverId}`);
                const isDelivered = receiverCount > 0;

                const message = await Message.create({
                    sender: userId,
                    receiver: receiverId,
                    conversationId: targetConversationId,
                    text: original.text,
                    imageUrl: original.imageUrl || '',
                    type: original.type || 'text',
                    status: isDelivered ? 'delivered' : 'sent',
                });

                await Conversation.findByIdAndUpdate(targetConversationId, {
                    lastMessage: message._id,
                    updatedAt: new Date(),
                    $inc: { [`unreadCounts.${receiverId}`]: 1 }
                });

                const populated = await message.populate([
                    { path: 'sender', select: 'username displayName avatar' },
                ]);

                const serializedMessage = JSON.parse(JSON.stringify(populated));

                io.to(`conv_${targetConversationId}`).emit('newMessage', serializedMessage);
                io.to(`user_${receiverId}`).emit('messageNotification', { message: serializedMessage, conversationId: targetConversationId });
            } catch (err) { console.error('Forward error:', err); }
        });

        // Typing indicators
        socket.on('typing', ({ conversationId, receiverId }) => {
            io.to(`user_${receiverId}`).emit('userTyping', {
                userId,
                conversationId,
            });
        });

        socket.on('stopTyping', ({ conversationId, receiverId }) => {
            io.to(`user_${receiverId}`).emit('userStoppedTyping', {
                userId,
                conversationId,
            });
        });

        // Mark messages as seen
        socket.on('markSeen', async ({ conversationId, senderId }) => {
            try {
                await Message.updateMany(
                    {
                        conversationId,
                        sender: senderId,
                        receiver: userId,
                        status: { $ne: 'seen' },
                    },
                    { status: 'seen' }
                );

                // Re-zero unread count for current user
                await Conversation.findByIdAndUpdate(conversationId, {
                    $set: { [`unreadCounts.${userId}`]: 0 }
                });

                io.to(`user_${senderId}`).emit('messagesSeen', {
                    conversationId,
                    seenBy: userId,
                });
            } catch (error) {
                console.error('Mark seen error:', error);
            }
        });

        // Add reaction to message
        socket.on('addReaction', async ({ messageId, emoji, conversationId }) => {
            try {
                const message = await Message.findById(messageId);
                if (!message) return;

                // Remove existing reaction from this user first
                message.reactions = message.reactions.filter(
                    (r) => r.userId.toString() !== userId
                );
                // Add new reaction
                message.reactions.push({ emoji, userId });
                await message.save();

                io.to(`conv_${conversationId}`).emit('reactionUpdated', {
                    messageId,
                    reactions: message.reactions,
                });
            } catch (error) {
                console.error('Add reaction error:', error);
            }
        });

        // Remove reaction from message
        socket.on('removeReaction', async ({ messageId, conversationId }) => {
            try {
                const message = await Message.findById(messageId);
                if (!message) return;

                message.reactions = message.reactions.filter(
                    (r) => r.userId.toString() !== userId
                );
                await message.save();

                io.to(`conv_${conversationId}`).emit('reactionUpdated', {
                    messageId,
                    reactions: message.reactions,
                });
            } catch (error) {
                console.error('Remove reaction error:', error);
            }
        });

        // Delete message for me
        socket.on('deleteForMe', async ({ messageId, conversationId }) => {
            try {
                await Message.findByIdAndUpdate(messageId, {
                    $addToSet: { deletedFor: userId },
                });
                socket.emit('messageDeletedForMe', { messageId, conversationId });
            } catch (error) {
                console.error('Delete for me error:', error);
            }
        });

        // Delete message for everyone
        socket.on('deleteForEveryone', async ({ messageId, conversationId }) => {
            try {
                const message = await Message.findById(messageId);

                if (!message || message.sender.toString() !== userId) {
                    return;
                }

                message.deletedForEveryone = true;
                message.text = '🚫 This message was deleted';
                await message.save();

                io.to(`conv_${conversationId}`).emit('messageDeletedForEveryone', {
                    messageId,
                    conversationId,
                });
            } catch (error) {
                console.error('Delete for everyone error:', error);
            }
        });

        // Explicit logout
        socket.on('logout', async () => {
            await redisClient.sRem(`active_sockets:${userId}`, socket.id);
            const size = await redisClient.sCard(`active_sockets:${userId}`);

            if (size === 0) {
                await User.findByIdAndUpdate(userId, { isOnline: false, lastSeen: new Date() });

                const currentUser = await User.findById(userId);
                if (!currentUser || currentUser.isHidden !== true) {
                    const participantIds = await fetchParticipants();
                    participantIds.forEach((pId) => {
                        io.to(`user_${pId}`).emit('userOffline', { userId, lastSeen: new Date() });
                    });
                }
            }
        });

        // Disconnect
        socket.on('disconnect', async () => {
            await redisClient.sRem(`active_sockets:${userId}`, socket.id);
            const size = await redisClient.sCard(`active_sockets:${userId}`);

            if (size === 0) {
                // Update last seen and socket offline state
                await User.findByIdAndUpdate(userId, { isOnline: false, lastSeen: new Date() });

                const currentUser = await User.findById(userId);
                if (!currentUser || currentUser.isHidden !== true) {
                    const participantIds = await fetchParticipants();
                    participantIds.forEach((pId) => {
                        io.to(`user_${pId}`).emit('userOffline', { userId, lastSeen: new Date() });
                    });
                }
            }
        });
    });
};


