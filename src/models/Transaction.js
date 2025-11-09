import mongoose from 'mongoose';

const transactionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },

  // Payment details
  paymentIntentId: {
    type: String,
    unique: true,
    sparse: true
  },
  cardLast4: {
    type: String,
    default: null
  },
  cardBrand: {
    type: String,
    default: null
  },
  amountUSD: {
    type: Number,
    required: [true, 'USD amount is required'],
    min: 10,
    max: 10000
  },
  currency: {
    type: String,
    default: 'USD',
    uppercase: true
  },

  // USDT conversion
  usdtAmount: {
    type: Number,
    required: true
  },
  exchangeRate: {
    type: Number,
    required: true
  },
  conversionFee: {
    type: Number,
    required: true
  },
  feePercentage: {
    type: Number,
    required: true
  },

  // Status tracking
  status: {
    type: String,
    enum: [
      'pending',
      'payment_processing',
      'payment_confirmed',
      'converting_to_usdt',
      'usdt_sent',
      'completed',
      'failed'
    ],
    default: 'pending',
    index: true
  },

  // Timestamps
  initiatedAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  paymentConfirmedAt: {
    type: Date,
    default: null
  },
  usdtSentAt: {
    type: Date,
    default: null
  },
  completedAt: {
    type: Date,
    default: null
  },

  // USDT details
  walletAddress: {
    type: String,
    required: [true, 'Wallet address is required'],
    trim: true
  },
  transactionHash: {
    type: String,
    default: null
  },
  blockchainNetwork: {
    type: String,
    default: 'TRC20', // Tron network (cheapest fees)
    enum: ['TRC20', 'ERC20', 'BEP20']
  },

  // Error handling
  errorMessage: {
    type: String,
    default: null
  },

  // Additional metadata
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true
});

// Indexes for efficient queries
transactionSchema.index({ userId: 1, createdAt: -1 });
transactionSchema.index({ status: 1, createdAt: -1 });
transactionSchema.index({ paymentIntentId: 1 });

// Calculate completion time
transactionSchema.virtual('processingTime').get(function() {
  if (this.completedAt && this.initiatedAt) {
    return Math.round((this.completedAt - this.initiatedAt) / 1000); // seconds
  }
  return null;
});

const Transaction = mongoose.model('Transaction', transactionSchema);

export default Transaction;
