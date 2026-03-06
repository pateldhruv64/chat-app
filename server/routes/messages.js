import express from 'express';
import auth from '../middleware/auth.js';
import {
    getMessages,
    getConversations,
    getOrCreateConversation,
    getConversationById,
} from '../controllers/messageController.js';

const router = express.Router();

router.get('/conversations', auth, getConversations);
router.get('/conversation/:userId', auth, getOrCreateConversation);
router.get('/conv/:conversationId', auth, getConversationById);
router.get('/:conversationId', auth, getMessages);

export default router;
