import User from '../models/User.model.js';
import { catchAsync } from '../middleware/error.middleware.js';
import { AppError } from '../middleware/error.middleware.js';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
} from '../middleware/auth.middleware.js';

// Cookie options
const getCookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
});

// Send token response
const sendTokenResponse = async (user, statusCode, res, message = 'Success') => {
  // Generate tokens
  const accessToken = generateAccessToken(user._id);
  const refreshToken = generateRefreshToken(user._id);

  // Save refresh token to user
  user.refreshToken = refreshToken;
  await user.save({ validateBeforeSave: false });

  // Set refresh token in cookie
  res.cookie('refreshToken', refreshToken, getCookieOptions());

  // Remove sensitive data
  user.password = undefined;
  user.refreshToken = undefined;

  res.status(statusCode).json({
    success: true,
    message,
    data: {
      user,
      accessToken,
    },
  });
};

// @desc    Register new user
// @route   POST /api/auth/register
// @access  Public
export const register = catchAsync(async (req, res, next) => {
  const { name, email, password, university, campus } = req.body;

  // Check if user already exists
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    return next(new AppError('User with this email already exists', 400));
  }

  // Create user
  const user = await User.create({
    name,
    email,
    password,
    university,
    campus,
    authProvider: 'local',
  });

  // Send token response
  await sendTokenResponse(user, 201, res, 'Registration successful');
});

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
export const login = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;

  // Check if user exists and get password
  const user = await User.findOne({ email }).select('+password');

  if (!user) {
    return next(new AppError('Invalid email or password', 401));
  }

  // Check if account is active
  if (!user.isActive) {
    return next(
      new AppError('Your account has been deactivated. Please contact support.', 403)
    );
  }

  // Check if password matches
  const isPasswordCorrect = await user.comparePassword(password);

  if (!isPasswordCorrect) {
    return next(new AppError('Invalid email or password', 401));
  }

  // Update last active
  await user.updateLastActive();

  // Send token response
  await sendTokenResponse(user, 200, res, 'Login successful');
});

// @desc    Logout user
// @route   POST /api/auth/logout
// @access  Private
export const logout = catchAsync(async (req, res, next) => {
  // Clear refresh token from database
  await User.findByIdAndUpdate(req.user._id, {
    refreshToken: null,
  });

  // Clear cookie
  res.cookie('refreshToken', '', {
    httpOnly: true,
    expires: new Date(0),
  });

  res.status(200).json({
    success: true,
    message: 'Logged out successfully',
  });
});

// @desc    Refresh access token
// @route   POST /api/auth/refresh
// @access  Public
export const refreshAccessToken = catchAsync(async (req, res, next) => {
  // Get refresh token from cookie or body
  const refreshToken = req.cookies.refreshToken || req.body.refreshToken;

  if (!refreshToken) {
    return next(new AppError('Refresh token not found', 401));
  }

  // Verify refresh token
  const decoded = verifyRefreshToken(refreshToken);

  if (!decoded) {
    return next(new AppError('Invalid or expired refresh token', 401));
  }

  // Get user and check refresh token matches
  const user = await User.findById(decoded.id).select('+refreshToken');

  if (!user || user.refreshToken !== refreshToken) {
    return next(new AppError('Invalid refresh token', 401));
  }

  // Check if account is active
  if (!user.isActive) {
    return next(new AppError('Account is deactivated', 403));
  }

  // Generate new access token
  const accessToken = generateAccessToken(user._id);

  // Remove sensitive data
  user.password = undefined;
  user.refreshToken = undefined;

  res.status(200).json({
    success: true,
    message: 'Token refreshed successfully',
    data: {
      accessToken,
    },
  });
});

// @desc    Get current logged in user
// @route   GET /api/auth/me
// @access  Private
export const getMe = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.user._id)
    .populate('listings', 'title price images status')
    .populate('savedListings', 'title price images status');

  res.status(200).json({
    success: true,
    data: {
      user,
    },
  });
});

// @desc    Update password
// @route   PUT /api/auth/password
// @access  Private
export const updatePassword = catchAsync(async (req, res, next) => {
  const { currentPassword, newPassword } = req.body;

  // Validation
  if (!currentPassword || !newPassword) {
    return next(new AppError('Please provide current and new password', 400));
  }

  if (newPassword.length < 6) {
    return next(new AppError('New password must be at least 6 characters', 400));
  }

  // Get user with password
  const user = await User.findById(req.user._id).select('+password');

  // Check if using OAuth
  if (user.authProvider !== 'local') {
    return next(
      new AppError('Cannot update password for OAuth accounts', 400)
    );
  }

  // Verify current password
  const isPasswordCorrect = await user.comparePassword(currentPassword);

  if (!isPasswordCorrect) {
    return next(new AppError('Current password is incorrect', 401));
  }

  // Update password
  user.password = newPassword;
  await user.save();

  // Send new token response
  await sendTokenResponse(user, 200, res, 'Password updated successfully');
});

// @desc    Verify email (placeholder for email verification flow)
// @route   GET /api/auth/verify/:token
// @access  Public
export const verifyEmail = catchAsync(async (req, res, next) => {
  // This is a placeholder - implement full email verification logic
  const { token } = req.params;

  // Verify token and update user
  // For now, just return success
  res.status(200).json({
    success: true,
    message: 'Email verification feature - implement with email service',
  });
});

// @desc    Request password reset
// @route   POST /api/auth/forgot-password
// @access  Public
export const forgotPassword = catchAsync(async (req, res, next) => {
  const { email } = req.body;

  const user = await User.findOne({ email });

  if (!user) {
    // Don't reveal if user exists
    return res.status(200).json({
      success: true,
      message: 'If an account exists, a password reset email has been sent',
    });
  }

  // Generate reset token (implement with email service)
  // For now, just return success
  res.status(200).json({
    success: true,
    message: 'Password reset feature - implement with email service',
  });
});

// @desc    Reset password
// @route   POST /api/auth/reset-password/:token
// @access  Public
export const resetPassword = catchAsync(async (req, res, next) => {
  const { token } = req.params;
  const { password } = req.body;

  // Verify token and update password (implement with email service)
  // For now, just return success
  res.status(200).json({
    success: true,
    message: 'Password reset feature - implement with email service',
  });
});

// @desc    Delete account
// @route   DELETE /api/auth/account
// @access  Private
export const deleteAccount = catchAsync(async (req, res, next) => {
  const { password } = req.body;

  // Get user with password
  const user = await User.findById(req.user._id).select('+password');

  // Verify password if local auth
  if (user.authProvider === 'local') {
    if (!password) {
      return next(new AppError('Please provide your password', 400));
    }

    const isPasswordCorrect = await user.comparePassword(password);

    if (!isPasswordCorrect) {
      return next(new AppError('Incorrect password', 401));
    }
  }

  // Deactivate account instead of deleting
  user.isActive = false;
  user.refreshToken = null;
  await user.save({ validateBeforeSave: false });

  // Clear cookie
  res.cookie('refreshToken', '', {
    httpOnly: true,
    expires: new Date(0),
  });

  res.status(200).json({
    success: true,
    message: 'Account deactivated successfully',
  });
});

export default {
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
};