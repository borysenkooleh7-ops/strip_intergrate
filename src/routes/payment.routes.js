import express from 'express';
import PaymentController from '../controllers/paymentController.js';
import TransakController from '../controllers/transakController.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { validate, schemas } from '../middleware/validation.middleware.js';

const router = express.Router();

// Public routes
router.get('/conversion-rate', PaymentController.getConversionRate);
router.get('/market-data', PaymentController.getMarketData);
router.get('/compare-rates', PaymentController.compareRates);

// Webhook (Stripe will send raw body)
router.post(
  '/webhook',
  express.raw({ type: 'application/json' }),
  PaymentController.handleWebhook
);

// Protected routes - Stripe (Legacy)
router.post(
  '/create-intent',
  authenticate,
  validate(schemas.createPayment),
  PaymentController.createPaymentIntent
);

// Transak routes (On-Ramp)
router.get('/transak/config', TransakController.getConfig);

router.post(
  '/transak/create-order',
  authenticate,
  TransakController.createOrder
);

router.patch(
  '/transak/order/:orderId',
  authenticate,
  TransakController.updateOrderStatus
);

router.get(
  '/transak/order/:orderId',
  authenticate,
  TransakController.getOrder
);

// Transak webhook (public - Transak will call this)
router.post(
  '/transak/webhook',
  express.json(),
  TransakController.handleWebhook
);

export default router;
