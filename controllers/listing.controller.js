import Listing from '../models/Listing.model.js';
import User from '../models/User.model.js';
import { catchAsync } from '../middleware/error.middleware.js';
import { AppError } from '../middleware/error.middleware.js';

// @desc    Get all listings with filters
// @route   GET /api/listings
// @access  Public
export const getListings = catchAsync(async (req, res, next) => {
  const {
    category,
    condition,
    minPrice,
    maxPrice,
    university,
    campus,
    status = 'active',
    sort = '-createdAt',
    page = 1,
    limit = 20,
  } = req.query;

  // Build query
  const query = {};

  if (category) query.category = category;
  if (condition) query.condition = condition;
  if (status) query.status = status;

  if (minPrice || maxPrice) {
    query.price = {};
    if (minPrice) query.price.$gte = parseFloat(minPrice);
    if (maxPrice) query.price.$lte = parseFloat(maxPrice);
  }

  if (university) {
    query['location.university'] = { $regex: university, $options: 'i' };
  }

  if (campus) {
    query['location.campus'] = { $regex: campus, $options: 'i' };
  }

  // Pagination
  const skip = (page - 1) * limit;

  // Execute query
  const listings = await Listing.find(query)
    .sort(sort)
    .skip(skip)
    .limit(parseInt(limit))
    .populate('seller', 'name avatar rating lastActive');

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

// @desc    Search listings
// @route   GET /api/listings/search
// @access  Public
export const searchListings = catchAsync(async (req, res, next) => {
  const {
    q,
    category,
    minPrice,
    maxPrice,
    university,
    campus,
    page = 1,
    limit = 20,
  } = req.query;

  if (!q || q.trim().length < 2) {
    return next(new AppError('Search query must be at least 2 characters', 400));
  }

  // Build query
  const query = {
    status: 'active',
    $text: { $search: q },
  };

  if (category) query.category = category;

  if (minPrice || maxPrice) {
    query.price = {};
    if (minPrice) query.price.$gte = parseFloat(minPrice);
    if (maxPrice) query.price.$lte = parseFloat(maxPrice);
  }

  if (university) {
    query['location.university'] = { $regex: university, $options: 'i' };
  }

  if (campus) {
    query['location.campus'] = { $regex: campus, $options: 'i' };
  }

  // Pagination
  const skip = (page - 1) * limit;

  // Execute search with text score sorting
  const listings = await Listing.find(query)
    .select({ score: { $meta: 'textScore' } })
    .sort({ score: { $meta: 'textScore' } })
    .skip(skip)
    .limit(parseInt(limit))
    .populate('seller', 'name avatar rating');

  const total = await Listing.countDocuments(query);

  res.status(200).json({
    success: true,
    data: {
      listings,
      query: q,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    },
  });
});

// @desc    Get single listing by ID
// @route   GET /api/listings/:id
// @access  Public
export const getListingById = catchAsync(async (req, res, next) => {
  const listing = await Listing.findById(req.params.id).populate(
    'seller',
    'name avatar rating university campus createdAt lastActive'
  );

  if (!listing) {
    return next(new AppError('Listing not found', 404));
  }

  // Increment view count (don't wait for it)
  listing.incrementViews().catch((err) => console.error('Error incrementing views:', err));

  res.status(200).json({
    success: true,
    data: {
      listing,
    },
  });
});

// @desc    Create new listing
// @route   POST /api/listings
// @access  Private
export const createListing = catchAsync(async (req, res, next) => {
  // Add seller from authenticated user
  req.body.seller = req.user._id;

  // Set location from user profile if not provided
  if (!req.body.location) {
    req.body.location = {
      university: req.user.university,
      campus: req.user.campus,
    };
  }

  // Validate images
  if (!req.body.images || req.body.images.length === 0) {
    return next(new AppError('At least one image is required', 400));
  }

  if (req.body.images.length > 10) {
    return next(new AppError('Maximum 10 images allowed', 400));
  }

  // Create listing
  const listing = await Listing.create(req.body);

  // Add listing to user's listings array
  await User.findByIdAndUpdate(req.user._id, {
    $push: { listings: listing._id },
  });

  // Populate seller info
  await listing.populate('seller', 'name avatar rating');

  res.status(201).json({
    success: true,
    message: 'Listing created successfully',
    data: {
      listing,
    },
  });
});

// @desc    Update listing
// @route   PUT /api/listings/:id
// @access  Private
export const updateListing = catchAsync(async (req, res, next) => {
  let listing = await Listing.findById(req.params.id);

  if (!listing) {
    return next(new AppError('Listing not found', 404));
  }

  // Check ownership
  if (listing.seller.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
    return next(new AppError('Not authorized to update this listing', 403));
  }

  // Don't allow updating seller
  delete req.body.seller;

  // Update listing
  listing = await Listing.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  }).populate('seller', 'name avatar rating');

  res.status(200).json({
    success: true,
    message: 'Listing updated successfully',
    data: {
      listing,
    },
  });
});

// @desc    Delete listing
// @route   DELETE /api/listings/:id
// @access  Private
export const deleteListing = catchAsync(async (req, res, next) => {
  const listing = await Listing.findById(req.params.id);

  if (!listing) {
    return next(new AppError('Listing not found', 404));
  }

  // Check ownership
  if (listing.seller.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
    return next(new AppError('Not authorized to delete this listing', 403));
  }

  // Delete listing
  await listing.deleteOne();

  // Remove from user's listings array
  await User.findByIdAndUpdate(req.user._id, {
    $pull: { listings: listing._id },
  });

  res.status(200).json({
    success: true,
    message: 'Listing deleted successfully',
  });
});

// @desc    Get featured listings
// @route   GET /api/listings/featured
// @access  Public
export const getFeaturedListings = catchAsync(async (req, res, next) => {
  const { limit = 10 } = req.query;

  const listings = await Listing.find({
    status: 'active',
    isFeatured: true,
  })
    .sort({ createdAt: -1 })
    .limit(parseInt(limit))
    .populate('seller', 'name avatar rating');

  res.status(200).json({
    success: true,
    data: {
      listings,
    },
  });
});

// @desc    Get listings by category
// @route   GET /api/listings/category/:category
// @access  Public
export const getListingsByCategory = catchAsync(async (req, res, next) => {
  const { category } = req.params;
  const { page = 1, limit = 20, sort = '-createdAt' } = req.query;

  // Validate category
  const validCategories = ['textbooks', 'notes', 'electronics', 'gadgets', 'furniture', 'other'];
  if (!validCategories.includes(category)) {
    return next(new AppError('Invalid category', 400));
  }

  // Pagination
  const skip = (page - 1) * limit;

  const listings = await Listing.find({
    category,
    status: 'active',
  })
    .sort(sort)
    .skip(skip)
    .limit(parseInt(limit))
    .populate('seller', 'name avatar rating');

  const total = await Listing.countDocuments({ category, status: 'active' });

  res.status(200).json({
    success: true,
    data: {
      listings,
      category,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    },
  });
});

// @desc    Get similar listings
// @route   GET /api/listings/:id/similar
// @access  Public
export const getSimilarListings = catchAsync(async (req, res, next) => {
  const listing = await Listing.findById(req.params.id);

  if (!listing) {
    return next(new AppError('Listing not found', 404));
  }

  // Find similar listings (same category, similar price range, same location)
  const priceRange = listing.price * 0.3; // 30% price range

  const similarListings = await Listing.find({
    _id: { $ne: listing._id }, // Exclude current listing
    status: 'active',
    category: listing.category,
    price: {
      $gte: listing.price - priceRange,
      $lte: listing.price + priceRange,
    },
    'location.university': listing.location.university,
  })
    .sort({ createdAt: -1 })
    .limit(6)
    .populate('seller', 'name avatar rating');

  res.status(200).json({
    success: true,
    data: {
      listings: similarListings,
    },
  });
});

// @desc    Mark listing as sold
// @route   PATCH /api/listings/:id/sold
// @access  Private
export const markAsSold = catchAsync(async (req, res, next) => {
  const listing = await Listing.findById(req.params.id);

  if (!listing) {
    return next(new AppError('Listing not found', 404));
  }

  // Check ownership
  if (listing.seller.toString() !== req.user._id.toString()) {
    return next(new AppError('Not authorized to update this listing', 403));
  }

  listing.status = 'sold';
  await listing.save();

  res.status(200).json({
    success: true,
    message: 'Listing marked as sold',
    data: {
      listing,
    },
  });
});

// @desc    Reactivate listing
// @route   PATCH /api/listings/:id/reactivate
// @access  Private
export const reactivateListing = catchAsync(async (req, res, next) => {
  const listing = await Listing.findById(req.params.id);

  if (!listing) {
    return next(new AppError('Listing not found', 404));
  }

  // Check ownership
  if (listing.seller.toString() !== req.user._id.toString()) {
    return next(new AppError('Not authorized to update this listing', 403));
  }

  if (listing.status !== 'sold' && listing.status !== 'inactive') {
    return next(new AppError('Only sold or inactive listings can be reactivated', 400));
  }

  listing.status = 'active';
  await listing.save();

  res.status(200).json({
    success: true,
    message: 'Listing reactivated successfully',
    data: {
      listing,
    },
  });
});

// @desc    Get listing statistics
// @route   GET /api/listings/stats/overview
// @access  Private (Admin)
export const getListingStats = catchAsync(async (req, res, next) => {
  // Category distribution
  const categoryStats = await Listing.aggregate([
    { $match: { status: 'active' } },
    {
      $group: {
        _id: '$category',
        count: { $sum: 1 },
        avgPrice: { $avg: '$price' },
      },
    },
  ]);

  // Status distribution
  const statusStats = await Listing.aggregate([
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
      },
    },
  ]);

  // Total listings
  const total = await Listing.countDocuments();

  res.status(200).json({
    success: true,
    data: {
      total,
      byCategory: categoryStats,
      byStatus: statusStats,
    },
  });
});

export default {
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
};