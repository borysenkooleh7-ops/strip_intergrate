import mongoose from 'mongoose';

const exchangeRateSchema = new mongoose.Schema({
  pair: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    default: 'USD_USDT'
  },
  rate: {
    type: Number,
    required: true
  },
  source: {
    type: String,
    required: true,
    enum: ['binance', 'coingecko', 'manual']
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  },
  expiresAt: {
    type: Date,
    required: true,
    index: true
  }
}, {
  timestamps: true
});

// Auto-delete expired rates
exchangeRateSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const ExchangeRate = mongoose.model('ExchangeRate', exchangeRateSchema);

export default ExchangeRate;
