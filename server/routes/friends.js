import express from 'express';
import auth from '../middleware/auth.js';
import {
    sendFriendRequest,
    acceptFriendRequest,
    rejectFriendRequest,
    getRequests,
    getFriendsList,
    removeFriend,
} from '../controllers/friendController.js';

const router = express.Router();

router.use(auth);

router.post('/request/:userId', sendFriendRequest);
router.put('/accept/:requestId', acceptFriendRequest);
router.put('/reject/:requestId', rejectFriendRequest);
router.get('/requests', getRequests);
router.get('/', getFriendsList);
router.get('/list', getFriendsList);
router.delete('/remove/:userId', removeFriend);
router.post('/remove/:userId', removeFriend);

export default router;
