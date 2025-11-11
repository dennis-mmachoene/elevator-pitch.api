import mongoose from 'mongoose';

const listingSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      minlength: [3, 'Title must be at least 3 characters'],
      maxlength: [100, 'Title cannot exceed 100 characters'],
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      trim: true,
      minlength: [10, 'Description must be at least 10 characters'],
      maxlength: [2000, 'Description cannot exceed 2000 characters'],
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      enum: ['textbooks', 'notes', 'electronics', 'gadgets', 'furniture', 'other'],
    },
    condition: {
      type: String,
      required: [true, 'Condition is required'],
      enum: ['new', 'like-new', 'good', 'fair', 'poor'],
    },
    price: {
      type: Number,
      required: [true, 'Price is required'],
      min: [0, 'Price cannot be negative'],
    },
    originalPrice: {
      type: Number,
      min: [0, 'Original price cannot be negative'],
    },
    images: [
      {
        url: {
          type: String,
          required: true,
        },
        publicId: {
          type: String,
          required: true,
        },
      },
    ],
    seller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    location: {
      university: {
        type: String,
        required: [true, 'University is required'],
      },
      campus: {
        type: String,
        required: [true, 'Campus is required'],
      },
      building: String,
      room: String,
    },
    tags: [
      {
        type: String,
        trim: true,
        lowercase: true,
      },
    ],
    status: {
      type: String,
      enum: ['active', 'sold', 'reserved', 'inactive'],
      default: 'active',
    },
    views: {
      type: Number,
      default: 0,
    },
    saves: {
      type: Number,
      default: 0,
    },
    isNegotiable: {
      type: Boolean,
      default: true,
    },
    isFeatured: {
      type: Boolean,
      default: false,
    },
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days
    },
    // For books specifically
    bookDetails: {
      isbn: String,
      author: String,
      edition: String,
      publisher: String,
      year: Number,
      subject: String,
    },
    // For notes specifically
    noteDetails: {
      subject: String,
      course: String,
      professor: String,
      semester: String,
      year: Number,
    },
    // For electronics/gadgets
    techDetails: {
      brand: String,
      model: String,
      year: Number,
      warranty: Boolean,
      warrantyExpiry: Date,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes for performance
listingSchema.index({ seller: 1, status: 1 });
listingSchema.index({ category: 1, status: 1 });
listingSchema.index({ 'location.university': 1, 'location.campus': 1, status: 1 });
listingSchema.index({ price: 1, status: 1 });
listingSchema.index({ createdAt: -1 });
listingSchema.index({ title: 'text', description: 'text', tags: 'text' });
listingSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL index

// Virtual populate for comments/reviews
listingSchema.virtual('reviews', {
  ref: 'Review',
  localField: '_id',
  foreignField: 'listing',
});

// Increment views
listingSchema.methods.incrementViews = function () {
  this.views += 1;
  return this.save({ validateBeforeSave: false });
};

// Check if listing is expired
listingSchema.methods.isExpired = function () {
  return this.expiresAt < new Date();
};

// Pre-save middleware to validate images
listingSchema.pre('save', function (next) {
  if (this.images.length === 0) {
    next(new Error('At least one image is required'));
  }
  if (this.images.length > 10) {
    next(new Error('Maximum 10 images allowed'));
  }
  next();
});

// Static method to get active listings by category
listingSchema.statics.getActiveByCategory = function (category, limit = 20) {
  return this.find({ category, status: 'active' })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('seller', 'name avatar rating');
};

// Static method for search
listingSchema.statics.search = function (query, filters = {}) {
  const searchCriteria = {
    status: 'active',
    $text: { $search: query },
    ...filters,
  };

  return this.find(searchCriteria)
    .sort({ score: { $meta: 'textScore' } })
    .populate('seller', 'name avatar rating');
};

const Listing = mongoose.model('Listing', listingSchema);

export default Listing;