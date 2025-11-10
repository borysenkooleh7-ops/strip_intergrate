import pkg from 'binance-api-node';
const Binance = pkg.default || pkg;
import config from '../config/environment.js';

/**
 * Binance Crypto Service
 * Handles real USDT transfers via Binance API
 *
 * IMPORTANT: You need to:
 * 1. Create a Binance account at https://www.binance.com
 * 2. Complete KYC verification
 * 3. Generate API Key at https://www.binance.com/en/my/settings/api-management
 * 4. Enable "Enable Withdrawals" permission on the API key
 * 5. Add your API key and secret to .env file
 * 6. Fund your Binance account with USDT
 */
class BinanceCryptoService {
  constructor() {
    this.client = null;
    this.isConfigured = false;
    this.initialize();
  }

  /**
   * Initialize Binance client
   */
  initialize() {
    try {
      if (!config.binance.apiKey || !config.binance.apiSecret) {
        console.warn('⚠️  Binance API credentials not configured. USDT transfers will be simulated.');
        return;
      }

      if (!Binance || typeof Binance !== 'function') {
        console.error('❌ Binance module not properly loaded');
        this.isConfigured = false;
        return;
      }

      this.client = Binance({
        apiKey: config.binance.apiKey,
        apiSecret: config.binance.apiSecret,
      });

      this.isConfigured = true;
      console.log('✅ Binance API client initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Binance client:', error.message);
      this.isConfigured = false;
    }
  }

  /**
   * Check if service is properly configured
   */
  isReady() {
    return this.isConfigured && this.client !== null;
  }

  /**
   * Get account USDT balance
   */
  async getUSDTBalance() {
    if (!this.isReady()) {
      throw new Error('Binance API not configured');
    }

    try {
      const accountInfo = await this.client.accountInfo();
      const usdtBalance = accountInfo.balances.find(b => b.asset === 'USDT');

      return {
        free: parseFloat(usdtBalance.free),
        locked: parseFloat(usdtBalance.locked),
        total: parseFloat(usdtBalance.free) + parseFloat(usdtBalance.locked)
      };
    } catch (error) {
      console.error('❌ Failed to get USDT balance:', error.message);
      throw new Error('Failed to retrieve USDT balance from Binance');
    }
  }

  /**
   * Validate USDT wallet address format
   * Supports: TRC20 (Tron), ERC20 (Ethereum), BEP20 (BSC)
   */
  validateWalletAddress(address, network = 'TRC20') {
    if (!address || typeof address !== 'string') {
      return { valid: false, error: 'Invalid wallet address format' };
    }

    // Remove whitespace
    address = address.trim();

    // TRC20 (Tron) - starts with T, 34 characters
    if (network === 'TRC20') {
      if (address.startsWith('T') && address.length === 34) {
        return { valid: true, address, network: 'TRC20' };
      }
      return { valid: false, error: 'Invalid TRC20 address. Must start with T and be 34 characters.' };
    }

    // ERC20 (Ethereum) - starts with 0x, 42 characters
    if (network === 'ERC20') {
      if (address.startsWith('0x') && address.length === 42) {
        return { valid: true, address, network: 'ERC20' };
      }
      return { valid: false, error: 'Invalid ERC20 address. Must start with 0x and be 42 characters.' };
    }

    // BEP20 (BSC) - starts with 0x, 42 characters (same as ERC20)
    if (network === 'BEP20') {
      if (address.startsWith('0x') && address.length === 42) {
        return { valid: true, address, network: 'BEP20' };
      }
      return { valid: false, error: 'Invalid BEP20 address. Must start with 0x and be 42 characters.' };
    }

    return { valid: false, error: 'Unsupported network. Use TRC20, ERC20, or BEP20.' };
  }

  /**
   * Send USDT to user wallet
   * @param {string} address - Recipient wallet address
   * @param {number} amount - Amount of USDT to send
   * @param {string} network - Network (TRC20, ERC20, BEP20)
   * @returns {Object} Transfer result with transaction hash
   */
  async sendUSDT(address, amount, network = 'TRC20') {
    if (!this.isReady()) {
      console.warn('⚠️  Binance not configured - simulating transfer');
      return this.simulateTransfer(address, amount, network);
    }

    try {
      // Validate wallet address
      const validation = this.validateWalletAddress(address, network);
      if (!validation.valid) {
        throw new Error(validation.error);
      }

      // Check if we have enough balance
      const balance = await this.getUSDTBalance();
      if (balance.free < amount) {
        throw new Error(`Insufficient USDT balance. Available: ${balance.free} USDT, Required: ${amount} USDT`);
      }

      console.log(`💸 Initiating USDT transfer: ${amount} USDT to ${address} via ${network}`);

      // Execute withdrawal
      const result = await this.client.withdraw({
        asset: 'USDT',
        address: address,
        amount: amount,
        network: network, // TRC20, ERC20, or BEP20
      });

      console.log('✅ USDT transfer initiated successfully');
      console.log('📝 Withdrawal ID:', result.id);

      return {
        success: true,
        transactionHash: result.id,
        amount: amount,
        address: address,
        network: network,
        timestamp: new Date(),
        status: 'pending', // Binance will process it
      };

    } catch (error) {
      console.error('❌ USDT transfer failed:', error.message);

      // Handle specific Binance API errors
      if (error.message.includes('Invalid address')) {
        throw new Error('Invalid wallet address. Please check and try again.');
      }
      if (error.message.includes('Insufficient balance')) {
        throw new Error('Insufficient USDT balance in system wallet.');
      }
      if (error.message.includes('Withdrawal not enabled')) {
        throw new Error('Withdrawal permission not enabled on API key. Please enable it in Binance API settings.');
      }

      throw new Error(`USDT transfer failed: ${error.message}`);
    }
  }

  /**
   * Verify withdrawal status
   * @param {string} withdrawalId - Binance withdrawal ID
   */
  async verifyWithdrawal(withdrawalId) {
    if (!this.isReady()) {
      return { status: 'completed' }; // Simulated
    }

    try {
      const history = await this.client.withdrawHistory({
        asset: 'USDT',
      });

      const withdrawal = history.find(w => w.id === withdrawalId);

      if (!withdrawal) {
        return { status: 'not_found' };
      }

      // Status codes:
      // 0: Email Sent
      // 1: Cancelled
      // 2: Awaiting Approval
      // 3: Rejected
      // 4: Processing
      // 5: Failure
      // 6: Completed

      const statusMap = {
        0: 'email_sent',
        1: 'cancelled',
        2: 'awaiting_approval',
        3: 'rejected',
        4: 'processing',
        5: 'failed',
        6: 'completed'
      };

      return {
        status: statusMap[withdrawal.status] || 'unknown',
        transactionHash: withdrawal.txId,
        amount: withdrawal.amount,
        network: withdrawal.network,
      };

    } catch (error) {
      console.error('❌ Failed to verify withdrawal:', error.message);
      throw new Error('Failed to verify withdrawal status');
    }
  }

  /**
   * Simulate transfer for testing/development
   * (When Binance API is not configured)
   */
  simulateTransfer(address, amount, network) {
    console.log('🔧 SIMULATION MODE: USDT transfer');
    console.log(`   Amount: ${amount} USDT`);
    console.log(`   Address: ${address}`);
    console.log(`   Network: ${network}`);

    // Validate address even in simulation
    const validation = this.validateWalletAddress(address, network);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    return {
      success: true,
      transactionHash: `SIMULATED_${Date.now()}`,
      amount: amount,
      address: address,
      network: network,
      timestamp: new Date(),
      status: 'completed',
      simulated: true
    };
  }

  /**
   * Get network fees for different networks
   */
  async getNetworkFees() {
    if (!this.isReady()) {
      return {
        TRC20: 1.0,  // Typical TRC20 fee
        ERC20: 10.0, // Typical ERC20 fee (can be much higher)
        BEP20: 0.5   // Typical BEP20 fee
      };
    }

    try {
      // Get current withdrawal fees from Binance
      const fees = await this.client.assetDetail();
      const usdtFees = fees.USDT || {};

      return {
        TRC20: parseFloat(usdtFees.withdrawFee || 1.0),
        ERC20: parseFloat(usdtFees.withdrawFee || 10.0),
        BEP20: parseFloat(usdtFees.withdrawFee || 0.5)
      };
    } catch (error) {
      console.error('❌ Failed to get network fees:', error.message);
      // Return default fees
      return {
        TRC20: 1.0,
        ERC20: 10.0,
        BEP20: 0.5
      };
    }
  }

  /**
   * Get recommended network based on amount
   * TRC20: Best for most transactions (low fee)
   * BEP20: Good alternative (low fee)
   * ERC20: High fee, only for large amounts
   */
  getRecommendedNetwork(amount) {
    if (amount >= 1000) {
      return 'ERC20'; // For large amounts, security is priority
    } else if (amount >= 100) {
      return 'BEP20'; // Good balance of security and cost
    } else {
      return 'TRC20'; // Best for small amounts
    }
  }
}

// Export singleton instance
const binanceCryptoService = new BinanceCryptoService();
export default binanceCryptoService;
