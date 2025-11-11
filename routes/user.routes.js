import express from 'express';
import {
  getUserById,
  updateProfile,
  getUserListings,
  getSavedListings,
  toggleSaveListing,
  getUserOrders,
  getUserStats,
  searchUsers,
  reportUser,
} from '../controllers/user.controller.js';
import { protect, optionalAuth } from '../middleware/auth.middleware.js';
import {
  updateProfileValidation,
  mongoIdValidation,
} from '../middleware/validation.middleware.js';

const router = express.Router();

// Public routes
router.get('/search', searchUsers);
router.get('/:id', optionalAuth, mongoIdValidation, getUserById);
router.get('/:id/listings', mongoIdValidation, getUserListings);
router.get('/:id/stats', mongoIdValidation, getUserStats);

// Protected routes
router.use(protect); // All routes below are protected

router.put('/me', updateProfileValidation, updateProfile);
router.get('/me/saved', getSavedListings);
router.post('/me/saved/:listingId', mongoIdValidation, toggleSaveListing);
router.get('/me/orders', getUserOrders);
router.post('/:id/report', mongoIdValidation, reportUser);

export default router;