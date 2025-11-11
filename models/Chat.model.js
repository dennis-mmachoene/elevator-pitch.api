import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema(
  {
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    content: {
      type: String,
      required: [true, 'Message content is required'],
      trim: true,
      maxlength: [2000, 'Message cannot exceed 2000 characters'],
    },
    type: {
      type: String,
      enum: ['text', 'image', 'offer'],
      default: 'text',
    },
    image: {
      url: String,
      publicId: String,
    },
    offer: {
      amount: Number,
      status: {
        type: String,
        enum: ['pending', 'accepted', 'rejected', 'withdrawn'],
        default: 'pending',
      },
    },
    isRead: {
      type: Boolean,
      default: false,
    },
    readAt: Date,
  },
  {
    timestamps: true,
  }
);

const chatSchema = new mongoose.Schema(
  {
    participants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
      },
    ],
    listing: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Listing',
      required: true,
    },
    messages: [messageSchema],
    lastMessage: {
      content: String,
      sender: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
      createdAt: Date,
    },
    unreadCount: {
      type: Map,
      of: Number,
      default: {},
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    blockedBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
  },
  {
    timestamps: true,
  }
);

// Compound index for participants + listing (ensures one chat per buyer-seller-listing)
chatSchema.index({ participants: 1, listing: 1 });
chatSchema.index({ 'lastMessage.createdAt': -1 });
chatSchema.index({ listing: 1 });

// Pre-save validation
chatSchema.pre('save', function (next) {
  if (this.participants.length !== 2) {
    next(new Error('Chat must have exactly 2 participants'));
  }
  next();
});

// Update last message
chatSchema.methods.updateLastMessage = function (message) {
  this.lastMessage = {
    content: message.content.substring(0, 100), // Truncate for preview
    sender: message.sender,
    createdAt: message.createdAt,
  };
  return this.save({ validateBeforeSave: false });
};

// Increment unread count for recipient
chatSchema.methods.incrementUnread = function (recipientId) {
  const currentCount = this.unreadCount.get(recipientId.toString()) || 0;
  this.unreadCount.set(recipientId.toString(), currentCount + 1);
  return this.save({ validateBeforeSave: false });
};

// Mark messages as read
chatSchema.methods.markAsRead = function (userId) {
  const now = new Date();
  let hasUnread = false;

  this.messages.forEach((message) => {
    if (
      !message.isRead &&
      message.sender.toString() !== userId.toString()
    ) {
      message.isRead = true;
      message.readAt = now;
      hasUnread = true;
    }
  });

  if (hasUnread) {
    this.unreadCount.set(userId.toString(), 0);
  }

  return this.save({ validateBeforeSave: false });
};

// Check if user is participant
chatSchema.methods.isParticipant = function (userId) {
  return this.participants.some(
    (participant) => participant.toString() === userId.toString()
  );
};

// Check if user blocked the chat
chatSchema.methods.isBlockedBy = function (userId) {
  return this.blockedBy.some(
    (blocked) => blocked.toString() === userId.toString()
  );
};

// Static method to find or create chat
chatSchema.statics.findOrCreate = async function (buyerId, sellerId, listingId) {
  let chat = await this.findOne({
    participants: { $all: [buyerId, sellerId] },
    listing: listingId,
  })
    .populate('participants', 'name avatar lastActive')
    .populate('listing', 'title price images status');

  if (!chat) {
    chat = await this.create({
      participants: [buyerId, sellerId],
      listing: listingId,
      unreadCount: {
        [buyerId]: 0,
        [sellerId]: 0,
      },
    });

    chat = await chat.populate('participants', 'name avatar lastActive');
    chat = await chat.populate('listing', 'title price images status');
  }

  return chat;
};

const Chat = mongoose.model('Chat', chatSchema);

export default Chat;