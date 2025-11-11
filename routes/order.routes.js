import express from 'express';
import {
  createOrder,
  getOrderById,
  getUserOrders,
  updateOrderStatus,
  updateMeetupDetails,
  addRating,
  cancelOrder,
  initiateDispute,
  addNotes,
} from '../controllers/order.controller.js';
import { protect } from '../middleware/auth.middleware.js';
import {
  createOrderValidation,
  updateOrderStatusValidation,
  addRatingValidation,
  mongoIdValidation,
} from '../middleware/validation.middleware.js';

const router = express.Router();

// All order routes are protected
router.use(protect);

router.post('/', createOrderValidation, createOrder);
router.get('/', getUserOrders);
router.get('/:id', mongoIdValidation, getOrderById);
router.put('/:id/status', mongoIdValidation, updateOrderStatusValidation, updateOrderStatus);
router.put('/:id/meetup', mongoIdValidation, updateMeetupDetails);
router.post('/:id/rating', mongoIdValidation, addRatingValidation, addRating);
router.post('/:id/cancel', mongoIdValidation, cancelOrder);
router.post('/:id/dispute', mongoIdValidation, initiateDispute);
router.put('/:id/notes', mongoIdValidation, addNotes);

export default router;