import Order from '../models/Order.model.js';
import Listing from '../models/Listing.model.js';
import User from '../models/User.model.js';
import { catchAsync } from '../middleware/error.middleware.js';
import { AppError } from '../middleware/error.middleware.js';

// @desc    Create new order
// @route   POST /api/orders
// @access  Private
export const createOrder = catchAsync(async (req, res, next) => {
  const { listingId, finalPrice, negotiatedPrice, meetupDetails, notes } = req.body;

  // Get listing
  const listing = await Listing.findById(listingId).populate('seller');

  if (!listing) {
    return next(new AppError('Listing not found', 404));
  }

  // Check listing status
  if (listing.status !== 'active') {
    return next(new AppError('This listing is not available', 400));
  }

  // Can't buy your own listing
  if (listing.seller._id.toString() === req.user._id.toString()) {
    return next(new AppError('You cannot buy your own listing', 400));
  }

  // Validate price
  if (finalPrice < 0) {
    return next(new AppError('Invalid price', 400));
  }

  // Create order
  const order = await Order.create({
    buyer: req.user._id,
    seller: listing.seller._id,
    listing: listing._id,
    listingSnapshot: {
      title: listing.title,
      description: listing.description,
      images: listing.images.map((img) => img.url),
      category: listing.category,
    },
    price: listing.price,
    negotiatedPrice,
    finalPrice,
    meetupDetails,
    notes: {
      buyer: notes,
    },
    timeline: [
      {
        status: 'pending',
        timestamp: new Date(),
        note: 'Order created',
      },
    ],
  });

  // Update listing status to reserved
  listing.status = 'reserved';
  await listing.save();

  // Add order to user's orders
  await User.findByIdAndUpdate(req.user._id, {
    $push: { orders: order._id },
  });

  await User.findByIdAndUpdate(listing.seller._id, {
    $push: { orders: order._id },
  });

  // Populate order
  await order.populate('buyer', 'name avatar rating phone');
  await order.populate('seller', 'name avatar rating phone');
  await order.populate('listing', 'title price images');

  // Send socket notification to seller
  const io = req.app.get('io');
  io.to(listing.seller._id.toString()).emit('new-order', {
    order,
  });

  res.status(201).json({
    success: true,
    message: 'Order created successfully',
    data: {
      order,
    },
  });
});

// @desc    Get order by ID
// @route   GET /api/orders/:id
// @access  Private
export const getOrderById = catchAsync(async (req, res, next) => {
  const order = await Order.findById(req.params.id)
    .populate('buyer', 'name avatar rating phone email')
    .populate('seller', 'name avatar rating phone email')
    .populate('listing', 'title price images status');

  if (!order) {
    return next(new AppError('Order not found', 404));
  }

  // Check if user is buyer or seller
  const userId = req.user._id.toString();
  if (
    order.buyer._id.toString() !== userId &&
    order.seller._id.toString() !== userId &&
    req.user.role !== 'admin'
  ) {
    return next(new AppError('Not authorized to view this order', 403));
  }

  res.status(200).json({
    success: true,
    data: {
      order,
    },
  });
});

// @desc    Get user's orders
// @route   GET /api/orders
// @access  Private
export const getUserOrders = catchAsync(async (req, res, next) => {
  const { role = 'buyer', status, page = 1, limit = 20 } = req.query;

  // Build query
  const query = {};
  if (role === 'buyer') {
    query.buyer = req.user._id;
  } else if (role === 'seller') {
    query.seller = req.user._id;
  } else {
    return next(new AppError('Invalid role. Use "buyer" or "seller"', 400));
  }

  if (status) {
    query.status = status;
  }

  // Pagination
  const skip = (page - 1) * limit;

  const orders = await Order.find(query)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit))
    .populate('buyer', 'name avatar rating')
    .populate('seller', 'name avatar rating')
    .populate('listing', 'title price images status');

  const total = await Order.countDocuments(query);

  res.status(200).json({
    success: true,
    data: {
      orders,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    },
  });
});

// @desc    Update order status
// @route   PUT /api/orders/:id/status
// @access  Private
export const updateOrderStatus = catchAsync(async (req, res, next) => {
  const { status, note } = req.body;

  const order = await Order.findById(req.params.id);

  if (!order) {
    return next(new AppError('Order not found', 404));
  }

  // Check if user is buyer or seller
  const userId = req.user._id.toString();
  const isBuyer = order.buyer.toString() === userId;
  const isSeller = order.seller.toString() === userId;

  if (!isBuyer && !isSeller && req.user.role !== 'admin') {
    return next(new AppError('Not authorized to update this order', 403));
  }

  // Validate status transitions
  const validTransitions = {
    pending: ['confirmed', 'cancelled'],
    confirmed: ['meetup-scheduled', 'cancelled'],
    'meetup-scheduled': ['in-progress', 'cancelled'],
    'in-progress': ['completed', 'disputed'],
    completed: [],
    cancelled: [],
    disputed: ['completed', 'cancelled'],
  };

  if (!validTransitions[order.status].includes(status)) {
    return next(
      new AppError(
        `Cannot change status from ${order.status} to ${status}`,
        400
      )
    );
  }

  // Update order
  await order.updateStatus(status, note);

  // If completed, update listing to sold
  if (status === 'completed') {
    await Listing.findByIdAndUpdate(order.listing, { status: 'sold' });
  }

  // If cancelled, reactivate listing
  if (status === 'cancelled') {
    await Listing.findByIdAndUpdate(order.listing, { status: 'active' });
  }

  // Populate order
  await order.populate('buyer', 'name avatar rating');
  await order.populate('seller', 'name avatar rating');
  await order.populate('listing', 'title price images');

  // Send socket notification
  const recipientId = isBuyer ? order.seller._id : order.buyer._id;
  const io = req.app.get('io');
  io.to(recipientId.toString()).emit('order-status-update', {
    orderId: order._id,
    status,
  });

  res.status(200).json({
    success: true,
    message: 'Order status updated successfully',
    data: {
      order,
    },
  });
});

// @desc    Update meetup details
// @route   PUT /api/orders/:id/meetup
// @access  Private
export const updateMeetupDetails = catchAsync(async (req, res, next) => {
  const { location, date, time, additionalInfo } = req.body;

  const order = await Order.findById(req.params.id);

  if (!order) {
    return next(new AppError('Order not found', 404));
  }

  // Check if user is buyer or seller
  const userId = req.user._id.toString();
  if (
    order.buyer.toString() !== userId &&
    order.seller.toString() !== userId
  ) {
    return next(new AppError('Not authorized to update this order', 403));
  }

  // Update meetup details
  order.meetupDetails = {
    location,
    date,
    time,
    additionalInfo,
  };

  // Update status to meetup-scheduled if confirmed
  if (order.status === 'confirmed') {
    await order.updateStatus('meetup-scheduled', 'Meetup details added');
  } else {
    await order.save();
  }

  // Send notification
  const recipientId =
    userId === order.buyer.toString() ? order.seller : order.buyer;
  const io = req.app.get('io');
  io.to(recipientId.toString()).emit('meetup-updated', {
    orderId: order._id,
    meetupDetails: order.meetupDetails,
  });

  res.status(200).json({
    success: true,
    message: 'Meetup details updated successfully',
    data: {
      order,
    },
  });
});

// @desc    Add rating to order
// @route   POST /api/orders/:id/rating
// @access  Private
export const addRating = catchAsync(async (req, res, next) => {
  const { score, review } = req.body;

  const order = await Order.findById(req.params.id);

  if (!order) {
    return next(new AppError('Order not found', 404));
  }

  // Check if order is completed
  if (!order.canBeRated()) {
    return next(new AppError('Only completed orders can be rated', 400));
  }

  // Check if user is buyer or seller
  const userId = req.user._id.toString();
  const isBuyer = order.buyer.toString() === userId;
  const isSeller = order.seller.toString() === userId;

  if (!isBuyer && !isSeller) {
    return next(new AppError('Not authorized to rate this order', 403));
  }

  // Check if already rated
  const existingRating = isBuyer
    ? order.rating.buyerRating
    : order.rating.sellerRating;

  if (existingRating?.score) {
    return next(new AppError('You have already rated this order', 400));
  }

  // Add rating
  await order.addRating(userId, score, review);

  res.status(200).json({
    success: true,
    message: 'Rating added successfully',
    data: {
      order,
    },
  });
});

// @desc    Cancel order
// @route   POST /api/orders/:id/cancel
// @access  Private
export const cancelOrder = catchAsync(async (req, res, next) => {
  const { reason } = req.body;

  if (!reason) {
    return next(new AppError('Cancellation reason is required', 400));
  }

  const order = await Order.findById(req.params.id);

  if (!order) {
    return next(new AppError('Order not found', 404));
  }

  // Check if user is buyer or seller
  const userId = req.user._id.toString();
  if (
    order.buyer.toString() !== userId &&
    order.seller.toString() !== userId
  ) {
    return next(new AppError('Not authorized to cancel this order', 403));
  }

  // Check if order can be cancelled
  if (!order.canBeCancelled()) {
    return next(
      new AppError('This order cannot be cancelled at this stage', 400)
    );
  }

  // Cancel order
  await order.cancel(userId, reason);

  // Reactivate listing
  await Listing.findByIdAndUpdate(order.listing, { status: 'active' });

  // Send notification
  const recipientId =
    userId === order.buyer.toString() ? order.seller : order.buyer;
  const io = req.app.get('io');
  io.to(recipientId.toString()).emit('order-cancelled', {
    orderId: order._id,
    reason,
  });

  res.status(200).json({
    success: true,
    message: 'Order cancelled successfully',
    data: {
      order,
    },
  });
});

// @desc    Initiate dispute
// @route   POST /api/orders/:id/dispute
// @access  Private
export const initiateDispute = catchAsync(async (req, res, next) => {
  const { reason } = req.body;

  if (!reason) {
    return next(new AppError('Dispute reason is required', 400));
  }

  const order = await Order.findById(req.params.id);

  if (!order) {
    return next(new AppError('Order not found', 404));
  }

  // Check if user is buyer or seller
  const userId = req.user._id.toString();
  if (
    order.buyer.toString() !== userId &&
    order.seller.toString() !== userId
  ) {
    return next(new AppError('Not authorized to dispute this order', 403));
  }

  // Check if already disputed
  if (order.status === 'disputed') {
    return next(new AppError('This order is already in dispute', 400));
  }

  // Initiate dispute
  await order.initiateDispute(userId, reason);

  res.status(200).json({
    success: true,
    message:
      'Dispute initiated. Our team will review and contact you shortly.',
    data: {
      order,
    },
  });
});

// @desc    Add notes to order
// @route   PUT /api/orders/:id/notes
// @access  Private
export const addNotes = catchAsync(async (req, res, next) => {
  const { notes } = req.body;

  if (!notes) {
    return next(new AppError('Notes are required', 400));
  }

  const order = await Order.findById(req.params.id);

  if (!order) {
    return next(new AppError('Order not found', 404));
  }

  // Check if user is buyer or seller
  const userId = req.user._id.toString();
  const isBuyer = order.buyer.toString() === userId;
  const isSeller = order.seller.toString() === userId;

  if (!isBuyer && !isSeller) {
    return next(new AppError('Not authorized to update this order', 403));
  }

  // Update notes
  if (isBuyer) {
    order.notes.buyer = notes;
  } else {
    order.notes.seller = notes;
  }

  await order.save();

  res.status(200).json({
    success: true,
    message: 'Notes updated successfully',
    data: {
      order,
    },
  });
});

export default {
  createOrder,
  getOrderById,
  getUserOrders,
  updateOrderStatus,
  updateMeetupDetails,
  addRating,
  cancelOrder,
  initiateDispute,
  addNotes,
};