import express from 'express';
import {
  getListings,
  searchListings,
  getListingById,
  createListing,
  updateListing,
  deleteListing,
  getFeaturedListings,
  getListingsByCategory,
  getSimilarListings,
  markAsSold,
  reactivateListing,
  getListingStats,
} from '../controllers/listing.controller.js';
import { protect, optionalAuth, restrictTo } from '../middleware/auth.middleware.js';
import {
  createListingValidation,
  updateListingValidation,
  searchValidation,
  mongoIdValidation,
} from '../middleware/validation.middleware.js';
import {
  createListingLimiter,
  searchLimiter,
} from '../middleware/rateLimiter.middleware.js';

const router = express.Router();

// Public routes
router.get('/', optionalAuth, getListings);
router.get('/search', searchLimiter, searchValidation, searchListings);
router.get('/featured', getFeaturedListings);
router.get('/category/:category', getListingsByCategory);
router.get('/stats/overview', protect, restrictTo('admin'), getListingStats);
router.get('/:id', optionalAuth, mongoIdValidation, getListingById);
router.get('/:id/similar', mongoIdValidation, getSimilarListings);

// Protected routes
router.use(protect); // All routes below are protected

router.post('/', createListingLimiter, createListingValidation, createListing);
router.put('/:id', mongoIdValidation, updateListingValidation, updateListing);
router.delete('/:id', mongoIdValidation, deleteListing);
router.patch('/:id/sold', mongoIdValidation, markAsSold);
router.patch('/:id/reactivate', mongoIdValidation, reactivateListing);

export default router;