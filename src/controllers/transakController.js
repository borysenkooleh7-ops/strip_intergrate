import Transaction from '../models/Transaction.js';
import logger from '../utils/logger.js';
import config from '../config/environment.js';

/**
 * Transak Payment Controller
 *
 * Handles Transak on-ramp integration for buying USDT directly
 *
 * Business Model:
 * - User buys USDT directly through Transak widget
 * - Transak charges 3-5% fee to user
 * - You earn 1-2% commission from Transak (configured in Transak dashboard)
 * - USDT goes directly to user's wallet (not through your backend)
 */
class TransakController {
  /**
   * Create Transak order
   * This creates a record in your database before opening Transak widget
   */
  static async createOrder(req, res, next) {
    try {
      const { usdAmount, walletAddress, network, provider } = req.body;
      const userId = req.user._id;

      // Validate required fields
      if (!usdAmount || !walletAddress || !network) {
        return res.status(400).json({
          success: false,
          message: 'Missing required fields: usdAmount, walletAddress, network'
        });
      }

      // Validate amount
      if (usdAmount < 30 || usdAmount > 10000) {
        return res.status(400).json({
          success: false,
          message: 'Amount must be between $30 and $10,000'
        });
      }

      // Validate wallet address format
      const isValid = TransakController.validateWalletAddress(walletAddress, network);
      if (!isValid) {
        return res.status(400).json({
          success: false,
          message: `Invalid wallet address for network ${network}`
        });
      }

      // Estimate USDT amount (rough estimate)
      // Transak charges ~4% fee, USDT is roughly 1:1 with USD
      const estimatedUSDT = usdAmount * 0.96; // After 4% fee

      // Create transaction record
      const transaction = await Transaction.create({
        userId: userId,
        paymentProvider: 'transak',
        amountUSD: usdAmount,
        currency: 'USD',
        usdtAmount: estimatedUSDT, // Estimated, will be updated by webhook
        walletAddress: walletAddress,
        blockchainNetwork: network,
        status: 'initiated',
        metadata: {
          provider: 'transak',
          transakOrderId: null, // Will be updated when webhook receives it
          network: network
        }
      });

      logger.info('Transak order created', {
        orderId: transaction._id,
        userId: userId,
        usdAmount: usdAmount,
        walletAddress: walletAddress,
        network: network
      });

      res.status(201).json({
        success: true,
        message: 'Order created successfully',
        data: {
          orderId: transaction._id,
          estimatedUSDT: estimatedUSDT
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update Transak order status
   * Called from frontend when Transak events are received
   */
  static async updateOrderStatus(req, res, next) {
    try {
      const { orderId } = req.params;
      const { status, transakOrderId, transakData, error } = req.body;

      // Find transaction
      const transaction = await Transaction.findById(orderId);
      if (!transaction) {
        return res.status(404).json({
          success: false,
          message: 'Transaction not found'
        });
      }

      // Verify ownership
      if (transaction.userId.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Unauthorized'
        });
      }

      // Update transaction
      transaction.status = status;

      if (transakOrderId) {
        transaction.metadata.transakOrderId = transakOrderId;
      }

      if (transakData) {
        transaction.metadata.transakData = transakData;

        // Update actual USDT amount if available
        if (transakData.cryptoAmount) {
          transaction.usdtAmount = parseFloat(transakData.cryptoAmount);
        }
      }

      if (error) {
        transaction.errorMessage = error;
      }

      if (status === 'completed') {
        transaction.completedAt = new Date();
        transaction.usdtSentAt = new Date(); // For consistency with old model
      }

      await transaction.save();

      logger.info('Transak order status updated', {
        orderId: orderId,
        status: status,
        transakOrderId: transakOrderId
      });

      // Emit socket event for real-time update
      global.io?.to(transaction.userId.toString()).emit('transaction_update', {
        transactionId: transaction._id,
        status: status,
        transakOrderId: transakOrderId
      });

      res.json({
        success: true,
        message: 'Order status updated',
        data: {
          transaction: transaction
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get Transak order details
   */
  static async getOrder(req, res, next) {
    try {
      const { orderId } = req.params;

      const transaction = await Transaction.findById(orderId);
      if (!transaction) {
        return res.status(404).json({
          success: false,
          message: 'Transaction not found'
        });
      }

      // Verify ownership
      if (transaction.userId.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Unauthorized'
        });
      }

      res.json({
        success: true,
        data: {
          transaction: transaction
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Webhook handler for Transak notifications
   * Transak will send webhook events to your backend when order status changes
   *
   * Setup in Transak Dashboard: https://dashboard.transak.com/
   * Webhook URL: https://your-domain.com/api/payments/transak/webhook
   */
  static async handleWebhook(req, res, next) {
    try {
      const webhookData = req.body;

      logger.info('Transak webhook received', {
        eventName: webhookData.eventName,
        orderId: webhookData.data?.partnerOrderId,
        transakOrderId: webhookData.data?.id,
        status: webhookData.data?.status
      });

      // Verify webhook signature (if Transak provides one)
      // TODO: Add webhook signature verification when Transak provides it
      // const isValid = verifyTransakWebhook(req);
      // if (!isValid) {
      //   return res.status(401).json({ success: false, message: 'Invalid webhook signature' });
      // }

      const eventName = webhookData.eventName;
      const data = webhookData.data;

      // Find transaction by partner order ID
      const transaction = await Transaction.findById(data.partnerOrderId);
      if (!transaction) {
        logger.warn('Transaction not found for Transak webhook', {
          partnerOrderId: data.partnerOrderId
        });
        return res.status(404).json({
          success: false,
          message: 'Transaction not found'
        });
      }

      // Update transaction based on event
      switch (eventName) {
        case 'ORDER_CREATED':
          transaction.status = 'pending';
          transaction.metadata.transakOrderId = data.id;
          break;

        case 'ORDER_PROCESSING':
          transaction.status = 'processing';
          break;

        case 'ORDER_COMPLETED':
          transaction.status = 'completed';
          transaction.completedAt = new Date();
          transaction.usdtSentAt = new Date();

          // Update actual USDT amount
          if (data.cryptoAmount) {
            transaction.usdtAmount = parseFloat(data.cryptoAmount);
          }

          // Store transaction hash if available
          if (data.transactionHash) {
            transaction.transactionHash = data.transactionHash;
          }
          break;

        case 'ORDER_FAILED':
          transaction.status = 'failed';
          transaction.errorMessage = data.statusMessage || 'Order failed';
          break;

        case 'ORDER_CANCELLED':
          transaction.status = 'cancelled';
          break;

        default:
          logger.warn('Unknown Transak webhook event', {
            eventName: eventName
          });
      }

      // Store full webhook data
      transaction.metadata.transakWebhookData = data;

      await transaction.save();

      logger.info('Transaction updated from Transak webhook', {
        transactionId: transaction._id,
        status: transaction.status,
        transakOrderId: data.id
      });

      // Emit socket event for real-time update
      global.io?.to(transaction.userId.toString()).emit('transaction_update', {
        transactionId: transaction._id,
        status: transaction.status,
        transakOrderId: data.id
      });

      res.json({ success: true });
    } catch (error) {
      logger.error('Error processing Transak webhook:', error);
      next(error);
    }
  }

  /**
   * Validate wallet address format
   */
  static validateWalletAddress(address, network) {
    if (!address || typeof address !== 'string') {
      return false;
    }

    address = address.trim();

    switch (network.toLowerCase()) {
      case 'tron':
      case 'trc20':
        // Tron addresses start with T and are 34 characters
        return address.startsWith('T') && address.length === 34;

      case 'ethereum':
      case 'erc20':
      case 'polygon':
      case 'bsc':
      case 'bep20':
        // EVM addresses start with 0x and are 42 characters
        return address.startsWith('0x') && address.length === 42;

      default:
        return false;
    }
  }

  /**
   * Get Transak configuration
   * Returns public config for frontend
   */
  static async getConfig(req, res, next) {
    try {
      res.json({
        success: true,
        data: {
          environment: config.transak.environment,
          supportedNetworks: ['tron', 'ethereum', 'polygon', 'bsc'],
          supportedCurrencies: ['USDT'],
          minAmount: 30,
          maxAmount: 10000
        }
      });
    } catch (error) {
      next(error);
    }
  }
}

export default TransakController;
