import express from 'express';
import PaymentController from '../controllers/paymentController.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { validate, schemas } from '../middleware/validation.middleware.js';

const router = express.Router();

// Public routes
router.get('/conversion-rate', PaymentController.getConversionRate);

// Webhook (Stripe will send raw body)
router.post(
  '/webhook',
  express.raw({ type: 'application/json' }),
  PaymentController.handleWebhook
);

// Protected routes
router.post(
  '/create-intent',
  authenticate,
  validate(schemas.createPayment),
  PaymentController.createPaymentIntent
);

export default router;
