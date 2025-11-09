import stripe from '../config/stripe.js';
import logger from '../utils/logger.js';

class StripeService {
  /**
   * Create a payment intent
   */
  static async createPaymentIntent(amount, currency, metadata = {}) {
    try {
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(amount * 100), // Convert to cents
        currency: currency.toLowerCase(),
        metadata: metadata,
        automatic_payment_methods: {
          enabled: true,
        },
      });

      logger.info('Payment intent created', {
        id: paymentIntent.id,
        amount: amount,
        currency: currency
      });

      return paymentIntent;
    } catch (error) {
      logger.error('Error creating payment intent:', error.message);
      throw new Error(`Failed to create payment intent: ${error.message}`);
    }
  }

  /**
   * Retrieve payment intent
   */
  static async getPaymentIntent(paymentIntentId) {
    try {
      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
      return paymentIntent;
    } catch (error) {
      logger.error('Error retrieving payment intent:', error.message);
      throw new Error(`Failed to retrieve payment intent: ${error.message}`);
    }
  }

  /**
   * Confirm payment intent
   */
  static async confirmPaymentIntent(paymentIntentId) {
    try {
      const paymentIntent = await stripe.paymentIntents.confirm(paymentIntentId);
      logger.info('Payment intent confirmed', { id: paymentIntentId });
      return paymentIntent;
    } catch (error) {
      logger.error('Error confirming payment intent:', error.message);
      throw new Error(`Failed to confirm payment intent: ${error.message}`);
    }
  }

  /**
   * Cancel payment intent
   */
  static async cancelPaymentIntent(paymentIntentId) {
    try {
      const paymentIntent = await stripe.paymentIntents.cancel(paymentIntentId);
      logger.info('Payment intent cancelled', { id: paymentIntentId });
      return paymentIntent;
    } catch (error) {
      logger.error('Error cancelling payment intent:', error.message);
      throw new Error(`Failed to cancel payment intent: ${error.message}`);
    }
  }

  /**
   * Create a refund
   */
  static async createRefund(paymentIntentId, amount = null) {
    try {
      const refund = await stripe.refunds.create({
        payment_intent: paymentIntentId,
        amount: amount ? Math.round(amount * 100) : undefined
      });

      logger.info('Refund created', {
        id: refund.id,
        paymentIntentId: paymentIntentId,
        amount: amount
      });

      return refund;
    } catch (error) {
      logger.error('Error creating refund:', error.message);
      throw new Error(`Failed to create refund: ${error.message}`);
    }
  }

  /**
   * Verify webhook signature
   */
  static verifyWebhookSignature(payload, signature, secret) {
    try {
      const event = stripe.webhooks.constructEvent(payload, signature, secret);
      return event;
    } catch (error) {
      logger.error('Webhook signature verification failed:', error.message);
      throw new Error(`Webhook signature verification failed: ${error.message}`);
    }
  }
}

export default StripeService;
