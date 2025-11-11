import express from 'express';
import {
  getUserChats,
  getOrCreateChat,
  getChatById,
  sendMessage,
  markChatAsRead,
  deleteChat,
  toggleBlockChat,
  respondToOffer,
  getUnreadCount,
} from '../controllers/chat.controller.js';
import { protect } from '../middleware/auth.middleware.js';
import {
  sendMessageValidation,
  mongoIdValidation,
} from '../middleware/validation.middleware.js';
import { messageLimiter } from '../middleware/rateLimiter.middleware.js';

const router = express.Router();

// All chat routes are protected
router.use(protect);

router.get('/', getUserChats);
router.post('/', getOrCreateChat);
router.get('/unread/count', getUnreadCount);
router.get('/:id', mongoIdValidation, getChatById);
router.post('/:id/messages', mongoIdValidation, messageLimiter, sendMessageValidation, sendMessage);
router.put('/:id/read', mongoIdValidation, markChatAsRead);
router.delete('/:id', mongoIdValidation, deleteChat);
router.put('/:id/block', mongoIdValidation, toggleBlockChat);
router.put('/:chatId/messages/:messageId/offer', respondToOffer);

export default router;