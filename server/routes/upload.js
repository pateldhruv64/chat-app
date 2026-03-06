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
        allowedFormats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
        transformation: [{ width: 1200, crop: 'limit' }],
    },
});

// Avatar storage
const avatarStorage = new CloudinaryStorage({
    cloudinary,
    params: {
        folder: 'chatapp/avatars',
        allowedFormats: ['jpg', 'jpeg', 'png', 'webp'],
        transformation: [{ width: 400, height: 400, crop: 'fill' }],
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
router.post('/image', auth, (req, res) => {
    const upload = uploadChatImage.single('image');
    upload(req, res, (err) => {
        if (err) {
            console.error('Multer/Cloudinary Upload Error (Chat Image):', err);
            return res.status(500).json({ message: 'Upload failed', error: err.message });
        }
        try {
            if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
            res.json({ url: req.file.path, publicId: req.file.filename });
        } catch (error) {
            console.error('Post-upload Error:', error);
            res.status(500).json({ message: 'Upload processing failed' });
        }
    });
});

// POST /api/upload/avatar — upload profile avatar
router.post('/avatar', auth, (req, res) => {
    const upload = uploadAvatar.single('avatar');
    upload(req, res, (err) => {
        if (err) {
            console.error('Multer/Cloudinary Upload Error (Avatar):', err);
            return res.status(500).json({ message: 'Upload failed', error: err.message });
        }
        try {
            if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
            res.json({ url: req.file.path, publicId: req.file.filename });
        } catch (error) {
            console.error('Post-upload Error:', error);
            res.status(500).json({ message: 'Upload processing failed' });
        }
    });
});

export default router;
