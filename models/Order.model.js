import mongoose from 'mongoose';

const orderSchema = new mongoose.Schema(
  {
    orderNumber: {
      type: String,
      required: true,
      unique: true,
    },
    buyer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    seller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    listing: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Listing',
      required: true,
    },
    // Snapshot of listing at time of order
    listingSnapshot: {
      title: String,
      description: String,
      images: [String],
      category: String,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    negotiatedPrice: {
      type: Number,
      min: 0,
    },
    finalPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    status: {
      type: String,
      enum: [
        'pending',
        'confirmed',
        'meetup-scheduled',
        'in-progress',
        'completed',
        'cancelled',
        'disputed',
      ],
      default: 'pending',
    },
    meetupDetails: {
      location: String,
      date: Date,
      time: String,
      additionalInfo: String,
    },
    timeline: [
      {
        status: String,
        timestamp: {
          type: Date,
          default: Date.now,
        },
        note: String,
      },
    ],
    rating: {
      buyerRating: {
        score: {
          type: Number,
          min: 1,
          max: 5,
        },
        review: String,
        createdAt: Date,
      },
      sellerRating: {
        score: {
          type: Number,
          min: 1,
          max: 5,
        },
        review: String,
        createdAt: Date,
      },
    },
    cancellation: {
      cancelledBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
      reason: String,
      timestamp: Date,
    },
    dispute: {
      initiatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
      reason: String,
      status: {
        type: String,
        enum: ['open', 'in-review', 'resolved'],
      },
      resolution: String,
      timestamp: Date,
    },
    notes: {
      buyer: String,
      seller: String,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
orderSchema.index({ buyer: 1, status: 1 });
orderSchema.index({ seller: 1, status: 1 });
orderSchema.index({ listing: 1 });
orderSchema.index({ orderNumber: 1 });
orderSchema.index({ createdAt: -1 });

// Pre-save middleware to generate order number
orderSchema.pre('save', async function (next) {
  if (!this.orderNumber) {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 7).toUpperCase();
    this.orderNumber = `EP-${timestamp}-${random}`;
  }
  next();
});

// Update timeline
orderSchema.methods.updateStatus = function (newStatus, note = '') {
  this.status = newStatus;
  this.timeline.push({
    status: newStatus,
    timestamp: new Date(),
    note,
  });
  return this.save();
};

// Add rating
orderSchema.methods.addRating = async function (userId, score, review) {
  const isBuyer = this.buyer.toString() === userId.toString();
  const ratingField = isBuyer ? 'buyerRating' : 'sellerRating';

  this.rating[ratingField] = {
    score,
    review,
    createdAt: new Date(),
  };

  await this.save();

  // Update user's average rating
  const User = mongoose.model('User');
  const targetUser = isBuyer ? this.seller : this.buyer;

  const orders = await this.constructor.find({
    [isBuyer ? 'seller' : 'buyer']: targetUser,
    status: 'completed',
    [`rating.${isBuyer ? 'buyerRating' : 'sellerRating'}.score`]: { $exists: true },
  });

  const totalRatings = orders.length;
  const sumRatings = orders.reduce((sum, order) => {
    const rating = isBuyer
      ? order.rating.buyerRating?.score
      : order.rating.sellerRating?.score;
    return sum + (rating || 0);
  }, 0);

  const averageRating = totalRatings > 0 ? sumRatings / totalRatings : 0;

  await User.findByIdAndUpdate(targetUser, {
    'rating.average': averageRating,
    'rating.count': totalRatings,
  });

  return this;
};

// Cancel order
orderSchema.methods.cancel = function (userId, reason) {
  this.status = 'cancelled';
  this.cancellation = {
    cancelledBy: userId,
    reason,
    timestamp: new Date(),
  };
  this.timeline.push({
    status: 'cancelled',
    timestamp: new Date(),
    note: `Cancelled by user. Reason: ${reason}`,
  });
  return this.save();
};

// Initiate dispute
orderSchema.methods.initiateDispute = function (userId, reason) {
  this.status = 'disputed';
  this.dispute = {
    initiatedBy: userId,
    reason,
    status: 'open',
    timestamp: new Date(),
  };
  this.timeline.push({
    status: 'disputed',
    timestamp: new Date(),
    note: `Dispute initiated: ${reason}`,
  });
  return this.save();
};

// Check if order can be rated
orderSchema.methods.canBeRated = function () {
  return this.status === 'completed';
};

// Check if order can be cancelled
orderSchema.methods.canBeCancelled = function () {
  return ['pending', 'confirmed', 'meetup-scheduled'].includes(this.status);
};

const Order = mongoose.model('Order', orderSchema);

export default Order;