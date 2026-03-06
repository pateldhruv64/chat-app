import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
    sender: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    receiver: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    conversationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Conversation',
        required: true,
    },
    text: {
        type: String,
        default: '',
        trim: true,
    },
    imageUrl: {
        type: String,
        default: '',
    },
    type: {
        type: String,
        enum: ['text', 'image'],
        default: 'text',
    },
    isPinned: {
        type: Boolean,
        default: false,
    },
    status: {
        type: String,
        enum: ['sent', 'delivered', 'seen'],
        default: 'sent',
    },
    reactions: [{
        emoji: String,
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    }],
    replyTo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Message',
        default: null,
    },
    deletedFor: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    }],
    deletedForEveryone: {
        type: Boolean,
        default: false,
    },
}, { timestamps: true });

messageSchema.index({ conversationId: 1, createdAt: -1 });

const Message = mongoose.model('Message', messageSchema);
export default Message;
