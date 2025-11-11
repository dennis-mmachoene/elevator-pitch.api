import Chat from '../models/Chat.model.js';
import Listing from '../models/Listing.model.js';
import { catchAsync } from '../middleware/error.middleware.js';
import { AppError } from '../middleware/error.middleware.js';

// @desc    Get all user's chats
// @route   GET /api/chat
// @access  Private
export const getUserChats = catchAsync(async (req, res, next) => {
  const { page = 1, limit = 20 } = req.query;
  const skip = (page - 1) * limit;

  const chats = await Chat.find({
    participants: req.user._id,
    isActive: true,
  })
    .sort({ 'lastMessage.createdAt': -1 })
    .skip(skip)
    .limit(parseInt(limit))
    .populate('participants', 'name avatar lastActive')
    .populate('listing', 'title price images status');

  const total = await Chat.countDocuments({
    participants: req.user._id,
    isActive: true,
  });

  // Calculate total unread count
  const totalUnread = chats.reduce((sum, chat) => {
    const unreadCount = chat.unreadCount.get(req.user._id.toString()) || 0;
    return sum + unreadCount;
  }, 0);

  res.status(200).json({
    success: true,
    data: {
      chats,
      totalUnread,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    },
  });
});

// @desc    Get or create chat
// @route   POST /api/chat
// @access  Private
export const getOrCreateChat = catchAsync(async (req, res, next) => {
  const { listingId, sellerId } = req.body;

  if (!listingId || !sellerId) {
    return next(new AppError('Listing ID and Seller ID are required', 400));
  }

  // Check if listing exists
  const listing = await Listing.findById(listingId);
  if (!listing) {
    return next(new AppError('Listing not found', 404));
  }

  // Can't chat with yourself
  if (sellerId === req.user._id.toString()) {
    return next(new AppError('You cannot chat with yourself', 400));
  }

  // Verify seller owns the listing
  if (listing.seller.toString() !== sellerId) {
    return next(new AppError('Invalid seller for this listing', 400));
  }

  // Find or create chat
  const chat = await Chat.findOrCreate(req.user._id, sellerId, listingId);

  res.status(200).json({
    success: true,
    data: {
      chat,
    },
  });
});

// @desc    Get chat by ID
// @route   GET /api/chat/:id
// @access  Private
export const getChatById = catchAsync(async (req, res, next) => {
  const chat = await Chat.findById(req.params.id)
    .populate('participants', 'name avatar lastActive')
    .populate('listing', 'title price images status seller')
    .populate('messages.sender', 'name avatar');

  if (!chat) {
    return next(new AppError('Chat not found', 404));
  }

  // Check if user is participant
  if (!chat.isParticipant(req.user._id)) {
    return next(new AppError('Not authorized to access this chat', 403));
  }

  // Mark messages as read
  await chat.markAsRead(req.user._id);

  res.status(200).json({
    success: true,
    data: {
      chat,
    },
  });
});

// @desc    Send message
// @route   POST /api/chat/:id/messages
// @access  Private
export const sendMessage = catchAsync(async (req, res, next) => {
  const { content, type = 'text', image, offer } = req.body;

  const chat = await Chat.findById(req.params.id);

  if (!chat) {
    return next(new AppError('Chat not found', 404));
  }

  // Check if user is participant
  if (!chat.isParticipant(req.user._id)) {
    return next(new AppError('Not authorized to send messages in this chat', 403));
  }

  // Check if chat is blocked
  if (chat.isBlockedBy(req.user._id)) {
    return next(new AppError('You have blocked this chat', 403));
  }

  // Get recipient
  const recipient = chat.participants.find(
    (p) => p.toString() !== req.user._id.toString()
  );

  if (chat.isBlockedBy(recipient)) {
    return next(new AppError('You cannot send messages to this user', 403));
  }

  // Create message object
  const message = {
    sender: req.user._id,
    content,
    type,
  };

  if (type === 'image' && image) {
    message.image = image;
  }

  if (type === 'offer' && offer) {
    message.offer = {
      amount: offer.amount,
      status: 'pending',
    };
  }

  // Add message to chat
  chat.messages.push(message);

  // Update last message
  await chat.updateLastMessage(message);

  // Increment unread count for recipient
  await chat.incrementUnread(recipient);

  // Populate sender info for response
  await chat.populate('messages.sender', 'name avatar');

  // Get the newly added message
  const newMessage = chat.messages[chat.messages.length - 1];

  // Emit socket event
  const io = req.app.get('io');
  io.to(recipient.toString()).emit('new-message', {
    chatId: chat._id,
    message: newMessage,
  });

  res.status(201).json({
    success: true,
    message: 'Message sent successfully',
    data: {
      message: newMessage,
    },
  });
});

// @desc    Mark chat as read
// @route   PUT /api/chat/:id/read
// @access  Private
export const markChatAsRead = catchAsync(async (req, res, next) => {
  const chat = await Chat.findById(req.params.id);

  if (!chat) {
    return next(new AppError('Chat not found', 404));
  }

  // Check if user is participant
  if (!chat.isParticipant(req.user._id)) {
    return next(new AppError('Not authorized to access this chat', 403));
  }

  await chat.markAsRead(req.user._id);

  res.status(200).json({
    success: true,
    message: 'Chat marked as read',
  });
});

// @desc    Delete chat (soft delete - set inactive)
// @route   DELETE /api/chat/:id
// @access  Private
export const deleteChat = catchAsync(async (req, res, next) => {
  const chat = await Chat.findById(req.params.id);

  if (!chat) {
    return next(new AppError('Chat not found', 404));
  }

  // Check if user is participant
  if (!chat.isParticipant(req.user._id)) {
    return next(new AppError('Not authorized to delete this chat', 403));
  }

  // Soft delete - set inactive
  chat.isActive = false;
  await chat.save();

  res.status(200).json({
    success: true,
    message: 'Chat deleted successfully',
  });
});

// @desc    Block/unblock chat
// @route   PUT /api/chat/:id/block
// @access  Private
export const toggleBlockChat = catchAsync(async (req, res, next) => {
  const chat = await Chat.findById(req.params.id);

  if (!chat) {
    return next(new AppError('Chat not found', 404));
  }

  // Check if user is participant
  if (!chat.isParticipant(req.user._id)) {
    return next(new AppError('Not authorized to modify this chat', 403));
  }

  const isBlocked = chat.isBlockedBy(req.user._id);

  if (isBlocked) {
    // Unblock
    chat.blockedBy = chat.blockedBy.filter(
      (id) => id.toString() !== req.user._id.toString()
    );
  } else {
    // Block
    chat.blockedBy.push(req.user._id);
  }

  await chat.save();

  res.status(200).json({
    success: true,
    message: isBlocked ? 'Chat unblocked successfully' : 'Chat blocked successfully',
    data: {
      blocked: !isBlocked,
    },
  });
});

// @desc    Respond to offer
// @route   PUT /api/chat/:chatId/messages/:messageId/offer
// @access  Private
export const respondToOffer = catchAsync(async (req, res, next) => {
  const { chatId, messageId } = req.params;
  const { status } = req.body; // 'accepted' or 'rejected'

  if (!['accepted', 'rejected'].includes(status)) {
    return next(new AppError('Invalid status. Use "accepted" or "rejected"', 400));
  }

  const chat = await Chat.findById(chatId).populate('listing');

  if (!chat) {
    return next(new AppError('Chat not found', 404));
  }

  // Check if user is the listing seller
  if (chat.listing.seller.toString() !== req.user._id.toString()) {
    return next(new AppError('Only the seller can respond to offers', 403));
  }

  // Find the message
  const message = chat.messages.id(messageId);

  if (!message) {
    return next(new AppError('Message not found', 404));
  }

  if (message.type !== 'offer') {
    return next(new AppError('This message is not an offer', 400));
  }

  if (message.offer.status !== 'pending') {
    return next(new AppError('This offer has already been responded to', 400));
  }

  // Update offer status
  message.offer.status = status;
  await chat.save();

  // Send notification to buyer
  const buyer = chat.participants.find(
    (p) => p.toString() !== req.user._id.toString()
  );

  const io = req.app.get('io');
  io.to(buyer.toString()).emit('offer-response', {
    chatId: chat._id,
    messageId: message._id,
    status,
  });

  res.status(200).json({
    success: true,
    message: `Offer ${status}`,
    data: {
      message,
    },
  });
});

// @desc    Get unread message count
// @route   GET /api/chat/unread/count
// @access  Private
export const getUnreadCount = catchAsync(async (req, res, next) => {
  const chats = await Chat.find({
    participants: req.user._id,
    isActive: true,
  }).select('unreadCount');

  const totalUnread = chats.reduce((sum, chat) => {
    const unreadCount = chat.unreadCount.get(req.user._id.toString()) || 0;
    return sum + unreadCount;
  }, 0);

  res.status(200).json({
    success: true,
    data: {
      unreadCount: totalUnread,
    },
  });
});

export default {
  getUserChats,
  getOrCreateChat,
  getChatById,
  sendMessage,
  markChatAsRead,
  deleteChat,
  toggleBlockChat,
  respondToOffer,
  getUnreadCount,
};