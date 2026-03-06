import express from 'express';
import rateLimit from 'express-rate-limit';
import { signup, login, getMe } from '../controllers/authController.js';
import auth from '../middleware/auth.js';

const router = express.Router();

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10,
    message: { message: 'Too many attempts, please try again after 15 minutes' },
    standardHeaders: true,
    legacyHeaders: false,
});

router.post('/signup', authLimiter, signup);
router.post('/login', authLimiter, login);
router.get('/me', auth, getMe);

export default router;
