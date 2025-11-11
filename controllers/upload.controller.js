import { catchAsync } from '../middleware/error.middleware.js';
import { AppError } from '../middleware/error.middleware.js';
import {
  uploadToCloudinary,
  uploadMultipleToCloudinary,
  uploadAvatar,
  deleteFromCloudinary,
} from '../utils/cloudinary.js';
import User from '../models/User.model.js';

// @desc    Upload single image
// @route   POST /api/upload/image
// @access  Private
export const uploadImage = catchAsync(async (req, res, next) => {
  if (!req.file) {
    return next(new AppError('Please upload an image', 400));
  }

  const result = await uploadToCloudinary(req.file.buffer, 'elevator-pitch/listings');

  res.status(200).json({
    success: true,
    message: 'Image uploaded successfully',
    data: {
      image: result,
    },
  });
});

// @desc    Upload multiple images
// @route   POST /api/upload/images
// @access  Private
export const uploadImages = catchAsync(async (req, res, next) => {
  if (!req.files || req.files.length === 0) {
    return next(new AppError('Please upload at least one image', 400));
  }

  const results = await uploadMultipleToCloudinary(
    req.files,
    'elevator-pitch/listings'
  );

  res.status(200).json({
    success: true,
    message: 'Images uploaded successfully',
    data: {
      images: results,
    },
  });
});

// @desc    Upload avatar
// @route   POST /api/upload/avatar
// @access  Private
export const uploadUserAvatar = catchAsync(async (req, res, next) => {
  if (!req.file) {
    return next(new AppError('Please upload an image', 400));
  }

  // Upload new avatar
  const result = await uploadAvatar(req.file.buffer);

  // Delete old avatar if it exists and it's not the default
  const user = await User.findById(req.user._id);
  if (user.avatar && !user.avatar.includes('avatar-default')) {
    // Extract public ID from URL
    const urlParts = user.avatar.split('/');
    const publicIdWithExt = urlParts.slice(-2).join('/');
    const publicId = publicIdWithExt.split('.')[0];

    try {
      await deleteFromCloudinary(publicId);
    } catch (error) {
      console.error('Error deleting old avatar:', error);
      // Continue even if deletion fails
    }
  }

  // Update user avatar
  user.avatar = result.url;
  await user.save({ validateBeforeSave: false });

  res.status(200).json({
    success: true,
    message: 'Avatar uploaded successfully',
    data: {
      avatar: result.url,
    },
  });
});

// @desc    Delete image
// @route   DELETE /api/upload/image
// @access  Private
export const deleteImage = catchAsync(async (req, res, next) => {
  const { publicId } = req.body;

  if (!publicId) {
    return next(new AppError('Public ID is required', 400));
  }

  await deleteFromCloudinary(publicId);

  res.status(200).json({
    success: true,
    message: 'Image deleted successfully',
  });
});

export default {
  uploadImage,
  uploadImages,
  uploadUserAvatar,
  deleteImage,
};