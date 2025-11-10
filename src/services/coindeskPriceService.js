import axios from 'axios';
import logger from '../utils/logger.js';
import config from '../config/environment.js';

/**
 * CoinDesk Price Data Service
 *
 * IMPORTANT: This service provides REAL-TIME PRICE DATA ONLY
 * - Gets current USD/USDT exchange rates
 * - Provides market data for display purposes
 * - Shows users the market rate vs your tiered rates
 *
 * DOES NOT:
 * - Execute USDT transfers
 * - Send USDT to wallets
 * - Interact with blockchain
 *
 * For actual USDT transfers, use binanceCryptoService.js
 */
class CoindeskPriceService {
  constructor() {
    this.baseURL = 'https://data-api.coindesk.com';
    this.publicAPI = 'https://api.coindesk.com/v1';
    this.apiKey = config.coindesk.apiKey;
    this.cache = {
      usdtPrice: null,
      lastUpdate: null,
      ttl: 60000 // 1 minute cache
    };
  }

  /**
   * Check if service is configured with API key
   */
  isConfigured() {
    return !!this.apiKey && this.apiKey !== 'your_coindesk_api_key_here';
  }

  /**
   * Get current USD/USDT exchange rate
   * This shows the MARKET RATE (typically 1:1 or close)
   */
  async getUSDTRate() {
    try {
      // Check cache first
      if (this.isCacheValid()) {
        logger.info('Using cached USDT rate', { rate: this.cache.usdtPrice });
        return this.cache.usdtPrice;
      }

      // Try authenticated API first (if configured)
      if (this.isConfigured()) {
        try {
          const rate = await this.getAuthenticatedUSDTRate();
          this.updateCache(rate);
          return rate;
        } catch (error) {
          logger.warn('Authenticated CoinDesk API failed, falling back to public API', {
            error: error.message
          });
        }
      }

      // Fallback to public API
      const rate = await this.getPublicUSDTRate();
      this.updateCache(rate);
      return rate;

    } catch (error) {
      logger.error('Failed to get USDT rate from CoinDesk:', error.message);

      // Return fallback rate
      return this.getFallbackRate();
    }
  }

  /**
   * Get USDT rate using authenticated API (with your token)
   */
  async getAuthenticatedUSDTRate() {
    logger.info('Fetching USDT rate from CoinDesk Data API (authenticated)');

    const response = await axios.get(`${this.baseURL}/v2/ticker/USDT`, {
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });

    // Parse response based on CoinDesk Data API format
    const rate = this.parseDataAPIResponse(response.data);

    logger.info('✅ USDT rate fetched (authenticated)', { rate });
    return rate;
  }

  /**
   * Get USDT rate from public CoinDesk API (no auth required)
   */
  async getPublicUSDTRate() {
    logger.info('Fetching USDT rate from CoinDesk Public API');

    // CoinDesk public API provides BPI (Bitcoin Price Index)
    // We'll use a crypto price API for USDT/USD rate
    const response = await axios.get('https://api.coingecko.com/api/v3/simple/price', {
      params: {
        ids: 'tether',
        vs_currencies: 'usd'
      },
      timeout: 10000
    });

    const rate = response.data.tether.usd;

    logger.info('✅ USDT rate fetched (public API)', { rate });
    return rate;
  }

  /**
   * Parse CoinDesk Data API response
   */
  parseDataAPIResponse(data) {
    // CoinDesk Data API format may vary
    // Common formats: { price: 1.0001 } or { data: { price: 1.0001 } }
    if (data.price) return parseFloat(data.price);
    if (data.data && data.data.price) return parseFloat(data.data.price);
    if (data.last) return parseFloat(data.last);

    // If format is unknown, assume USDT is close to 1:1 with USD
    logger.warn('Unknown CoinDesk API response format, using default 1:1 rate');
    return 1.0;
  }

  /**
   * Get comprehensive market data for USDT
   */
  async getUSDTMarketData() {
    try {
      const currentRate = await this.getUSDTRate();

      return {
        symbol: 'USDT',
        name: 'Tether USD',
        price: currentRate,
        currency: 'USD',
        timestamp: new Date(),
        source: this.isConfigured() ? 'CoinDesk Data API' : 'Public API',
        note: 'Market rate for reference only. Your conversion rates are tiered based on amount.'
      };

    } catch (error) {
      logger.error('Failed to get USDT market data:', error.message);
      throw new Error('Unable to fetch market data');
    }
  }

  /**
   * Compare your tiered rates vs market rate
   * This shows users how much you're charging above market
   */
  async compareRateWithMarket(usdAmount, yourUSDTRate) {
    try {
      const marketRate = await this.getUSDTRate();
      const marketUSDT = usdAmount * marketRate;
      const yourUSDT = usdAmount * yourUSDTRate;
      const difference = marketUSDT - yourUSDT;
      const differencePercent = ((difference / marketUSDT) * 100).toFixed(2);

      return {
        usdAmount,
        marketRate: {
          rate: marketRate,
          usdtAmount: marketUSDT,
          source: 'CoinDesk'
        },
        yourRate: {
          rate: yourUSDTRate,
          usdtAmount: yourUSDT,
          source: 'Your Tiered Pricing'
        },
        difference: {
          usdtAmount: difference,
          percentage: parseFloat(differencePercent),
          note: `Your fee is ${differencePercent}% of market value`
        },
        timestamp: new Date()
      };

    } catch (error) {
      logger.error('Failed to compare rates:', error.message);
      return null;
    }
  }

  /**
   * Get historical USDT prices (for charts/analytics)
   */
  async getHistoricalPrices(days = 7) {
    try {
      // Use CoinGecko for historical data (public API)
      const response = await axios.get('https://api.coingecko.com/api/v3/coins/tether/market_chart', {
        params: {
          vs_currency: 'usd',
          days: days,
          interval: 'daily'
        },
        timeout: 10000
      });

      const prices = response.data.prices.map(([timestamp, price]) => ({
        date: new Date(timestamp),
        price: price
      }));

      logger.info(`Fetched ${prices.length} historical USDT prices`);
      return prices;

    } catch (error) {
      logger.error('Failed to get historical prices:', error.message);
      return [];
    }
  }

  /**
   * Check if cached data is still valid
   */
  isCacheValid() {
    if (!this.cache.usdtPrice || !this.cache.lastUpdate) {
      return false;
    }

    const age = Date.now() - this.cache.lastUpdate;
    return age < this.cache.ttl;
  }

  /**
   * Update cache with new rate
   */
  updateCache(rate) {
    this.cache.usdtPrice = rate;
    this.cache.lastUpdate = Date.now();
  }

  /**
   * Get fallback rate when API fails
   */
  getFallbackRate() {
    logger.warn('Using fallback USDT rate: 1.00');
    return 1.0; // USDT is typically 1:1 with USD
  }

  /**
   * Health check for CoinDesk API
   */
  async healthCheck() {
    try {
      const rate = await this.getUSDTRate();

      return {
        status: 'healthy',
        configured: this.isConfigured(),
        apiType: this.isConfigured() ? 'authenticated' : 'public',
        currentRate: rate,
        cacheValid: this.isCacheValid(),
        timestamp: new Date()
      };

    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        configured: this.isConfigured(),
        timestamp: new Date()
      };
    }
  }
}

// Export singleton instance
const coindeskPriceService = new CoindeskPriceService();
export default coindeskPriceService;
