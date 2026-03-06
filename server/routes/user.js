import express from 'express';
import auth from '../middleware/auth.js';
import {
    getProfile,
    updateProfile,
    searchByUniqueId,
    getSuggestions,
    blockUser,
    unblockUser,
    deleteAccount,
    changePassword,
    toggleOnlineStatus,
} from '../controllers/userController.js';

const router = express.Router();

router.get('/profile', auth, getProfile);
router.put('/profile', auth, updateProfile);
router.delete('/profile', auth, deleteAccount);
router.get('/search/:uniqueId', auth, searchByUniqueId);
router.get('/suggestions', auth, getSuggestions);
router.post('/block/:userId', auth, blockUser);
router.post('/unblock/:userId', auth, unblockUser);
router.post('/change-password', auth, changePassword);
router.post('/toggle-status', auth, toggleOnlineStatus);

export default router;
