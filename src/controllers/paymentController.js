import Transaction from '../models/Transaction.js';
import StripeService from '../services/stripeService.js';
import USDTConversionService from '../services/usdtConversionService.js';
import coindeskPriceService from '../services/coindeskPriceService.js';
import config from '../config/environment.js';
import logger from '../utils/logger.js';

class PaymentController {
  /**
   * Create payment intent
   */
  static async createPaymentIntent(req, res, next) {
    try {
      const { usdAmount, walletAddress, currency = 'USD', network = 'TRC20' } = req.body;
      const userId = req.user._id;

      // Validate wallet address
      if (!USDTConversionService.validateWalletAddress(walletAddress, network)) {
        return res.status(400).json({
          success: false,
          message: `Invalid ${network} wallet address`
        });
      }

      // Calculate USDT conversion
      const conversion = USDTConversionService.calculateConversion(usdAmount);

      // Create Stripe payment intent
      const paymentIntent = await StripeService.createPaymentIntent(
        usdAmount,
        currency,
        {
          userId: userId.toString(),
          walletAddress: walletAddress,
          usdtAmount: conversion.usdtAmount.toString(),
          network: network
        }
      );

      // Create transaction record
      const transaction = await Transaction.create({
        userId: userId,
        paymentIntentId: paymentIntent.id,
        amountUSD: usdAmount,
        currency: currency,
        usdtAmount: conversion.usdtAmount,
        exchangeRate: conversion.exchangeRate,
        conversionFee: conversion.conversionFee,
        feePercentage: conversion.feePercentage,
        walletAddress: walletAddress,
        blockchainNetwork: network,
        status: 'pending',
        metadata: {
          tierName: conversion.tierName
        }
      });

      logger.info('Payment intent created', {
        transactionId: transaction._id,
        userId: userId,
        amount: usdAmount,
        usdtAmount: conversion.usdtAmount
      });

      res.status(201).json({
        success: true,
        message: 'Payment intent created successfully',
        data: {
          clientSecret: paymentIntent.client_secret,
          transaction: transaction,
          conversion: conversion
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Handle Stripe webhook
   */
  static async handleWebhook(req, res, next) {
    const sig = req.headers['stripe-signature'];

    try {
      const event = StripeService.verifyWebhookSignature(
        req.body,
        sig,
        config.stripe.webhookSecret
      );

      logger.info('Webhook received', { type: event.type });

      // Handle different event types
      switch (event.type) {
        case 'payment_intent.succeeded':
          await PaymentController.handlePaymentSuccess(event.data.object);
          break;

        case 'payment_intent.payment_failed':
          await PaymentController.handlePaymentFailed(event.data.object);
          break;

        case 'payment_intent.canceled':
          await PaymentController.handlePaymentCanceled(event.data.object);
          break;

        default:
          logger.warn('Unhandled webhook event type', { type: event.type });
      }

      res.json({ received: true });
    } catch (error) {
      logger.error('Webhook error:', error.message);
      res.status(400).json({
        success: false,
        message: 'Webhook error'
      });
    }
  }

  /**
   * Handle successful payment
   */
  static async handlePaymentSuccess(paymentIntent) {
    try {
      const transaction = await Transaction.findOne({
        paymentIntentId: paymentIntent.id
      });

      if (!transaction) {
        logger.error('Transaction not found for payment intent', {
          paymentIntentId: paymentIntent.id
        });
        return;
      }

      // Update transaction with payment details
      transaction.status = 'payment_confirmed';
      transaction.paymentConfirmedAt = new Date();
      transaction.cardLast4 = paymentIntent.charges?.data[0]?.payment_method_details?.card?.last4;
      transaction.cardBrand = paymentIntent.charges?.data[0]?.payment_method_details?.card?.brand;
      await transaction.save();

      logger.info('Payment confirmed', { transactionId: transaction._id });

      // Emit socket event for real-time update
      global.io?.to(transaction.userId.toString()).emit('transaction_update', {
        transactionId: transaction._id,
        status: 'payment_confirmed'
      });

      // Start USDT conversion process
      await PaymentController.processUSDTConversion(transaction);
    } catch (error) {
      logger.error('Error handling payment success:', error);
    }
  }

  /**
   * Process USDT conversion
   */
  static async processUSDTConversion(transaction) {
    try {
      // Update status
      transaction.status = 'converting_to_usdt';
      await transaction.save();

      // Emit socket event
      global.io?.to(transaction.userId.toString()).emit('transaction_update', {
        transactionId: transaction._id,
        status: 'converting_to_usdt'
      });

      logger.info('Starting USDT conversion', { transactionId: transaction._id });

      // Execute REAL USDT transfer via Binance (falls back to simulation if not configured)
      const transfer = await USDTConversionService.executeUSDTTransfer(
        transaction._id,
        transaction.walletAddress,
        transaction.usdtAmount,
        transaction.blockchainNetwork || 'TRC20'
      );

      // Update transaction with transfer details
      transaction.status = 'usdt_sent';
      transaction.usdtSentAt = new Date();
      transaction.transactionHash = transfer.transactionHash;
      transaction.blockchainNetwork = transfer.network;

      // Store metadata about whether this was a real or simulated transfer
      if (!transaction.metadata) transaction.metadata = {};
      transaction.metadata.isRealTransfer = transfer.isReal || false;
      transaction.metadata.explorerUrl = transfer.explorerUrl;

      await transaction.save();

      // Emit socket event
      global.io?.to(transaction.userId.toString()).emit('transaction_update', {
        transactionId: transaction._id,
        status: 'usdt_sent',
        transactionHash: transfer.transactionHash
      });

      logger.info('USDT sent successfully', {
        transactionId: transaction._id,
        txHash: transfer.transactionHash
      });

      // Mark as completed
      await PaymentController.completeTransaction(transaction);
    } catch (error) {
      logger.error('Error processing USDT conversion:', error);

      transaction.status = 'failed';
      transaction.errorMessage = error.message;
      await transaction.save();

      // Emit error event
      global.io?.to(transaction.userId.toString()).emit('transaction_update', {
        transactionId: transaction._id,
        status: 'failed',
        error: error.message
      });
    }
  }

  /**
   * Complete transaction
   */
  static async completeTransaction(transaction) {
    transaction.status = 'completed';
    transaction.completedAt = new Date();
    await transaction.save();

    logger.info('Transaction completed', { transactionId: transaction._id });

    // Emit final socket event
    global.io?.to(transaction.userId.toString()).emit('transaction_update', {
      transactionId: transaction._id,
      status: 'completed'
    });
  }

  /**
   * Handle payment failure
   */
  static async handlePaymentFailed(paymentIntent) {
    try {
      const transaction = await Transaction.findOne({
        paymentIntentId: paymentIntent.id
      });

      if (!transaction) return;

      transaction.status = 'failed';
      transaction.errorMessage = paymentIntent.last_payment_error?.message || 'Payment failed';
      await transaction.save();

      logger.warn('Payment failed', {
        transactionId: transaction._id,
        error: transaction.errorMessage
      });

      // Emit socket event
      global.io?.to(transaction.userId.toString()).emit('transaction_update', {
        transactionId: transaction._id,
        status: 'failed',
        error: transaction.errorMessage
      });
    } catch (error) {
      logger.error('Error handling payment failure:', error);
    }
  }

  /**
   * Handle payment cancellation
   */
  static async handlePaymentCanceled(paymentIntent) {
    try {
      const transaction = await Transaction.findOne({
        paymentIntentId: paymentIntent.id
      });

      if (!transaction) return;

      transaction.status = 'failed';
      transaction.errorMessage = 'Payment was canceled';
      await transaction.save();

      logger.info('Payment canceled', { transactionId: transaction._id });

      // Emit socket event
      global.io?.to(transaction.userId.toString()).emit('transaction_update', {
        transactionId: transaction._id,
        status: 'failed',
        error: 'Payment was canceled'
      });
    } catch (error) {
      logger.error('Error handling payment cancellation:', error);
    }
  }

  /**
   * Get conversion rate
   */
  static async getConversionRate(req, res, next) {
    try {
      const { amount } = req.query;

      if (amount) {
        const conversion = USDTConversionService.calculateConversion(parseFloat(amount));

        // Get market rate comparison from CoinDesk
        let marketComparison = null;
        try {
          marketComparison = await coindeskPriceService.compareRateWithMarket(
            parseFloat(amount),
            conversion.exchangeRate
          );
        } catch (error) {
          logger.warn('Could not fetch market comparison:', error.message);
        }

        return res.json({
          success: true,
          data: {
            ...conversion,
            marketComparison: marketComparison
          }
        });
      }

      // Return all tiers with market data
      const tiers = USDTConversionService.getAllTiers();
      const marketRate = await USDTConversionService.getMarketRate();

      // Get CoinDesk market data
      let coindeskMarketData = null;
      try {
        coindeskMarketData = await coindeskPriceService.getUSDTMarketData();
      } catch (error) {
        logger.warn('Could not fetch CoinDesk market data:', error.message);
      }

      res.json({
        success: true,
        data: {
          tiers: tiers,
          marketRate: marketRate,
          coindeskMarketData: coindeskMarketData,
          lastUpdated: new Date()
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get real-time market data from CoinDesk
   */
  static async getMarketData(req, res, next) {
    try {
      const marketData = await coindeskPriceService.getUSDTMarketData();
      const healthCheck = await coindeskPriceService.healthCheck();

      res.json({
        success: true,
        data: {
          market: marketData,
          apiStatus: healthCheck
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Compare rates - show user the difference between market and your rates
   */
  static async compareRates(req, res, next) {
    try {
      const { amount } = req.query;

      if (!amount) {
        return res.status(400).json({
          success: false,
          message: 'Amount parameter is required'
        });
      }

      const usdAmount = parseFloat(amount);
      const conversion = USDTConversionService.calculateConversion(usdAmount);
      const comparison = await coindeskPriceService.compareRateWithMarket(
        usdAmount,
        conversion.exchangeRate
      );

      res.json({
        success: true,
        data: {
          yourRate: {
            tier: conversion.tierName,
            rate: conversion.exchangeRate,
            usdtAmount: conversion.usdtAmount,
            fee: conversion.conversionFee,
            feePercentage: conversion.feePercentage
          },
          marketRate: comparison.marketRate,
          comparison: comparison.difference,
          note: 'Market rate shown for transparency. Your tiered rates include service fees.',
          timestamp: new Date()
        }
      });
    } catch (error) {
      next(error);
    }
  }
}

export default PaymentController;
