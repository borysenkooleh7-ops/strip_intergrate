import express from 'express';
import TransactionController from '../controllers/transactionController.js';
import { authenticate, authorize } from '../middleware/auth.middleware.js';

const router = express.Router();

// User routes
router.get('/', authenticate, TransactionController.getTransactions);
router.get('/statistics', authenticate, TransactionController.getStatistics);
router.get('/:id', authenticate, TransactionController.getTransaction);

// Admin routes
router.get(
  '/admin/all',
  authenticate,
  authorize('admin'),
  TransactionController.getAllTransactions
);

router.get(
  '/admin/statistics',
  authenticate,
  authorize('admin'),
  TransactionController.getAdminStatistics
);

export default router;
