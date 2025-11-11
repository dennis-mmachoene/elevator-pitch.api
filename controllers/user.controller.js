import User from '../models/User.model.js';
import Listing from '../models/Listing.model.js';
import Order from '../models/Order.model.js';
import { catchAsync } from '../middleware/error.middleware.js';
import { AppError } from '../middleware/error.middleware.js';

// @desc    Get user profile by ID
// @route   GET /api/users/:id
// @access  Public
export const getUserById = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.params.id)
    .select('-password -refreshToken')
    .populate('listings', 'title price images status createdAt');

  if (!user) {
    return next(new AppError('User not found', 404));
  }

  if (!user.isActive) {
    return next(new AppError('User account is deactivated', 404));
  }

  res.status(200).json({
    success: true,
    data: {
      user,
    },
  });
});

// @desc    Update user profile
// @route   PUT /api/users/me
// @access  Private
export const updateProfile = catchAsync(async (req, res, next) => {
  const allowedFields = [
    'name',
    'university',
    'campus',
    'phone',
    'bio',
    'avatar',
  ];

  // Filter req.body to only allowed fields
  const updates = {};
  Object.keys(req.body).forEach((key) => {
    if (allowedFields.includes(key)) {
      updates[key] = req.body[key];
    }
  });

  // Don't allow empty name
  if (updates.name && updates.name.trim().length === 0) {
    return next(new AppError('Name cannot be empty', 400));
  }

  const user = await User.findByIdAndUpdate(req.user._id, updates, {
    new: true,
    runValidators: true,
  }).select('-password -refreshToken');

  res.status(200).json({
    success: true,
    message: 'Profile updated successfully',
    data: {
      user,
    },
  });
});

// @desc    Get user's listings
// @route   GET /api/users/:id/listings
// @access  Public
export const getUserListings = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { status, page = 1, limit = 20 } = req.query;

  // Check if user exists
  const user = await User.findById(id);
  if (!user) {
    return next(new AppError('User not found', 404));
  }

  // Build query
  const query = { seller: id };
  if (status) {
    query.status = status;
  }

  // Pagination
  const skip = (page - 1) * limit;

  const listings = await Listing.find(query)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit))
    .populate('seller', 'name avatar rating');

  const total = await Listing.countDocuments(query);

  res.status(200).json({
    success: true,
    data: {
      listings,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    },
  });
});

// @desc    Get user's saved listings
// @route   GET /api/users/me/saved
// @access  Private
export const getSavedListings = catchAsync(async (req, res, next) => {
  const { page = 1, limit = 20 } = req.query;

  const user = await User.findById(req.user._id)
    .select('savedListings')
    .populate({
      path: 'savedListings',
      match: { status: 'active' }, // Only show active listings
      options: {
        sort: { createdAt: -1 },
        skip: (page - 1) * limit,
        limit: parseInt(limit),
      },
      populate: {
        path: 'seller',
        select: 'name avatar rating',
      },
    });

  const total = user.savedListings.length;

  res.status(200).json({
    success: true,
    data: {
      listings: user.savedListings,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    },
  });
});

// @desc    Save/unsave a listing
// @route   POST /api/users/me/saved/:listingId
// @access  Private
export const toggleSaveListing = catchAsync(async (req, res, next) => {
  const { listingId } = req.params;

  // Check if listing exists
  const listing = await Listing.findById(listingId);
  if (!listing) {
    return next(new AppError('Listing not found', 404));
  }

  const user = await User.findById(req.user._id);

  // Check if already saved
  const index = user.savedListings.indexOf(listingId);
  let message;

  if (index > -1) {
    // Remove from saved
    user.savedListings.splice(index, 1);
    listing.saves = Math.max(0, listing.saves - 1);
    message = 'Listing removed from saved';
  } else {
    // Add to saved
    user.savedListings.push(listingId);
    listing.saves += 1;
    message = 'Listing saved successfully';
  }

  await user.save({ validateBeforeSave: false });
  await listing.save({ validateBeforeSave: false });

  res.status(200).json({
    success: true,
    message,
    data: {
      saved: index === -1, // true if just saved, false if unsaved
    },
  });
});

// @desc    Get user's orders (as buyer or seller)
// @route   GET /api/users/me/orders
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
    .populate('listing', 'title price images');

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

// @desc    Get user statistics
// @route   GET /api/users/:id/stats
// @access  Public
export const getUserStats = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  // Check if user exists
  const user = await User.findById(id);
  if (!user || !user.isActive) {
    return next(new AppError('User not found', 404));
  }

  // Get listing count by status
  const listingStats = await Listing.aggregate([
    { $match: { seller: user._id } },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
      },
    },
  ]);

  // Get order stats as seller
  const sellerOrderStats = await Order.aggregate([
    { $match: { seller: user._id } },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
      },
    },
  ]);

  // Get total sales
  const totalSales = await Order.countDocuments({
    seller: user._id,
    status: 'completed',
  });

  // Get total purchases
  const totalPurchases = await Order.countDocuments({
    buyer: user._id,
    status: 'completed',
  });

  // Format stats
  const listings = {};
  listingStats.forEach((stat) => {
    listings[stat._id] = stat.count;
  });

  const orders = {};
  sellerOrderStats.forEach((stat) => {
    orders[stat._id] = stat.count;
  });

  res.status(200).json({
    success: true,
    data: {
      stats: {
        listings,
        orders,
        totalSales,
        totalPurchases,
        rating: user.rating,
        memberSince: user.createdAt,
      },
    },
  });
});

// @desc    Search users
// @route   GET /api/users/search
// @access  Public
export const searchUsers = catchAsync(async (req, res, next) => {
  const { q, university, campus, page = 1, limit = 20 } = req.query;

  if (!q || q.trim().length < 2) {
    return next(new AppError('Search query must be at least 2 characters', 400));
  }

  // Build query
  const query = {
    isActive: true,
    $or: [
      { name: { $regex: q, $options: 'i' } },
      { email: { $regex: q, $options: 'i' } },
    ],
  };

  if (university) {
    query.university = { $regex: university, $options: 'i' };
  }

  if (campus) {
    query.campus = { $regex: campus, $options: 'i' };
  }

  // Pagination
  const skip = (page - 1) * limit;

  const users = await User.find(query)
    .select('name email avatar university campus rating createdAt')
    .sort({ 'rating.average': -1 })
    .skip(skip)
    .limit(parseInt(limit));

  const total = await User.countDocuments(query);

  res.status(200).json({
    success: true,
    data: {
      users,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    },
  });
});

// @desc    Report a user
// @route   POST /api/users/:id/report
// @access  Private
export const reportUser = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { reason, description } = req.body;

  if (!reason || !description) {
    return next(new AppError('Reason and description are required', 400));
  }

  // Check if user exists
  const user = await User.findById(id);
  if (!user) {
    return next(new AppError('User not found', 404));
  }

  // Can't report yourself
  if (id === req.user._id.toString()) {
    return next(new AppError('You cannot report yourself', 400));
  }

  // Here you would save the report to a Report model
  // For now, just return success
  // TODO: Implement Report model and save report

  res.status(200).json({
    success: true,
    message: 'User reported successfully. Our team will review this report.',
  });
});

export default {
  getUserById,
  updateProfile,
  getUserListings,
  getSavedListings,
  toggleSaveListing,
  getUserOrders,
  getUserStats,
  searchUsers,
  reportUser,
};