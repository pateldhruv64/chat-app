import multer from 'multer';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import cloudinary from '../config/cloudinary.js';
import auth from '../middleware/auth.js';
import express from 'express';

const router = express.Router();

// Chat image storage
const chatStorage = new CloudinaryStorage({
    cloudinary,
    params: {
        folder: 'chatapp/messages',
        allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
        transformation: [{ width: 1200, quality: 'auto', fetch_format: 'auto' }],
    },
});

// Avatar storage
const avatarStorage = new CloudinaryStorage({
    cloudinary,
    params: {
        folder: 'chatapp/avatars',
        allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
        transformation: [{ width: 400, height: 400, crop: 'fill', quality: 'auto' }],
    },
});

const uploadChatImage = multer({
    storage: chatStorage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

const uploadAvatar = multer({
    storage: avatarStorage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

// POST /api/upload/image — upload chat image
router.post('/image', auth, uploadChatImage.single('image'), (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
        res.json({ url: req.file.path, publicId: req.file.filename });
    } catch (err) {
        res.status(500).json({ message: 'Upload failed' });
    }
});

// POST /api/upload/avatar — upload profile avatar
router.post('/avatar', auth, uploadAvatar.single('avatar'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
        res.json({ url: req.file.path, publicId: req.file.filename });
    } catch (err) {
        res.status(500).json({ message: 'Upload failed' });
    }
});

export default router;
