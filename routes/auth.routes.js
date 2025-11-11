import express from 'express';
import {
  register,
  login,
  logout,
  refreshAccessToken,
  getMe,
  updatePassword,
  verifyEmail,
  forgotPassword,
  resetPassword,
  deleteAccount,
} from '../controllers/auth.controller.js';
import { protect } from '../middleware/auth.middleware.js';
import { authLimiter } from '../middleware/rateLimiter.middleware.js';
import {
  registerValidation,
  loginValidation,
} from '../middleware/validation.middleware.js';

const router = express.Router();

// Public routes with rate limiting
router.post('/register', authLimiter, registerValidation, register);
router.post('/login', authLimiter, loginValidation, login);
router.post('/refresh', refreshAccessToken);
router.get('/verify/:token', verifyEmail);
router.post('/forgot-password', authLimiter, forgotPassword);
router.post('/reset-password/:token', authLimiter, resetPassword);

// Protected routes
router.use(protect); // All routes below are protected

router.post('/logout', logout);
router.get('/me', getMe);
router.put('/password', updatePassword);
router.delete('/account', deleteAccount);

export default router;