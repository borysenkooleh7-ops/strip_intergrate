import axios from 'axios';
import ExchangeRate from '../models/ExchangeRate.js';
import logger from '../utils/logger.js';

class USDTConversionService {
  // Fixed rate tiers - YOUR BUSINESS MODEL
  static CONVERSION_TIERS = [
    { minUSD: 0,    maxUSD: 100,   usdtRate: 0.85, name: 'Starter' },
    { minUSD: 100,  maxUSD: 250,   usdtRate: 0.88, name: 'Basic' },
    { minUSD: 250,  maxUSD: 500,   usdtRate: 0.90, name: 'Standard' },  // $450 → 405 USDT
    { minUSD: 500,  maxUSD: 1000,  usdtRate: 0.91, name: 'Premium' },
    { minUSD: 1000, maxUSD: Infinity, usdtRate: 0.92, name: 'VIP' }
  ];

  static MIN_TRANSACTION = 10;
  static MAX_TRANSACTION = 10000;
  static MIN_PROFIT_MARGIN = 0.08; // 8% absolute minimum

  /**
   * Calculate USDT conversion with guaranteed rates
   */
  static calculateConversion(usdAmount) {
    // Validate amount
    if (usdAmount < this.MIN_TRANSACTION || usdAmount > this.MAX_TRANSACTION) {
      throw new Error(`Amount must be between $${this.MIN_TRANSACTION} and $${this.MAX_TRANSACTION}`);
    }

    // Find the appropriate tier
    const tier = this.CONVERSION_TIERS.find(
      t => usdAmount >= t.minUSD && usdAmount < t.maxUSD
    );

    if (!tier) {
      throw new Error('Invalid amount for conversion');
    }

    // Calculate USDT amount
    const usdtAmount = Math.floor(usdAmount * tier.usdtRate * 100) / 100; // Round down to 2 decimals
    const conversionFee = usdAmount - usdtAmount;
    const feePercentage = ((conversionFee / usdAmount) * 100);

    // Validate minimum profit margin
    if (feePercentage / 100 < this.MIN_PROFIT_MARGIN) {
      throw new Error('Insufficient profit margin - transaction rejected');
    }

    logger.info('Conversion calculated', {
      usdAmount,
      usdtAmount,
      tier: tier.name,
      rate: tier.usdtRate,
      fee: conversionFee,
      feePercentage: feePercentage.toFixed(2)
    });

    return {
      usdAmount,
      usdtAmount,
      exchangeRate: tier.usdtRate,
      conversionFee,
      feePercentage: parseFloat(feePercentage.toFixed(2)),
      tierName: tier.name,
      breakdown: {
        youPay: usdAmount,
        youReceive: usdtAmount,
        serviceFee: conversionFee,
        rate: `1 USD = ${tier.usdtRate} USDT`
      }
    };
  }

  /**
   * Get current market rate (optional - for display/comparison)
   */
  static async getMarketRate() {
    try {
      // Try to get cached rate first
      const cachedRate = await ExchangeRate.findOne({
        pair: 'USD_USDT',
        expiresAt: { $gt: new Date() }
      }).sort({ timestamp: -1 });

      if (cachedRate) {
        logger.info('Using cached exchange rate', { rate: cachedRate.rate });
        return cachedRate.rate;
      }

      // Fetch from Binance (free, no API key required)
      const response = await axios.get('https://api.binance.com/api/v3/ticker/price?symbol=USDCUSDT', {
        timeout: 5000
      });

      const rate = parseFloat(response.data.price);

      // Cache the rate for 5 minutes
      await ExchangeRate.findOneAndUpdate(
        { pair: 'USD_USDT' },
        {
          pair: 'USD_USDT',
          rate: rate,
          source: 'binance',
          timestamp: new Date(),
          expiresAt: new Date(Date.now() + 5 * 60 * 1000) // 5 minutes
        },
        { upsert: true, new: true }
      );

      logger.info('Fetched new market rate from Binance', { rate });
      return rate;

    } catch (error) {
      logger.error('Error fetching market rate:', error.message);

      // Fallback to default rate
      return 0.9995; // Approximate 1:1 for USDT
    }
  }

  /**
   * Get tier information for an amount
   */
  static getTierInfo(usdAmount) {
    const tier = this.CONVERSION_TIERS.find(
      t => usdAmount >= t.minUSD && usdAmount < t.maxUSD
    );

    return tier || null;
  }

  /**
   * Get all tiers (for display on frontend)
   */
  static getAllTiers() {
    return this.CONVERSION_TIERS.map(tier => ({
      name: tier.name,
      minUSD: tier.minUSD,
      maxUSD: tier.maxUSD === Infinity ? 'Unlimited' : tier.maxUSD,
      rate: tier.usdtRate,
      example: {
        pay: tier.minUSD + 50,
        receive: Math.floor((tier.minUSD + 50) * tier.usdtRate * 100) / 100
      }
    }));
  }

  /**
   * Simulate USDT transfer (for MVP)
   */
  static async simulateUSDTTransfer(transactionId, walletAddress, usdtAmount) {
    logger.info('Simulating USDT transfer', { transactionId, walletAddress, usdtAmount });

    // Simulate network delay (1-3 seconds)
    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));

    // Generate mock transaction hash
    const txHash = this.generateMockTxHash();

    logger.info('USDT transfer simulated', { transactionId, txHash });

    return {
      success: true,
      transactionHash: txHash,
      network: 'TRC20',
      explorerUrl: `https://tronscan.org/#/transaction/${txHash}`,
      timestamp: new Date()
    };
  }

  /**
   * Generate realistic-looking transaction hash
   */
  static generateMockTxHash() {
    const chars = '0123456789abcdef';
    let hash = '';
    for (let i = 0; i < 64; i++) {
      hash += chars[Math.floor(Math.random() * chars.length)];
    }
    return hash;
  }

  /**
   * Validate USDT wallet address (basic validation)
   */
  static validateWalletAddress(address, network = 'TRC20') {
    if (!address || typeof address !== 'string') {
      return false;
    }

    switch (network) {
      case 'TRC20': // Tron
        return /^T[A-Za-z1-9]{33}$/.test(address);
      case 'ERC20': // Ethereum
        return /^0x[a-fA-F0-9]{40}$/.test(address);
      case 'BEP20': // Binance Smart Chain
        return /^0x[a-fA-F0-9]{40}$/.test(address);
      default:
        return false;
    }
  }
}

export default USDTConversionService;
