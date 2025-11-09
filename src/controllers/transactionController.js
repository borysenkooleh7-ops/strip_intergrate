import Transaction from '../models/Transaction.js';
import logger from '../utils/logger.js';

class TransactionController {
  /**
   * Get all transactions for authenticated user
   */
  static async getTransactions(req, res, next) {
    try {
      const userId = req.user._id;
      const { status, page = 1, limit = 10, startDate, endDate } = req.query;

      // Build query
      const query = { userId };

      if (status) {
        query.status = status;
      }

      if (startDate || endDate) {
        query.initiatedAt = {};
        if (startDate) {
          query.initiatedAt.$gte = new Date(startDate);
        }
        if (endDate) {
          query.initiatedAt.$lte = new Date(endDate);
        }
      }

      // Execute query with pagination
      const transactions = await Transaction.find(query)
        .sort({ createdAt: -1 })
        .limit(parseInt(limit))
        .skip((parseInt(page) - 1) * parseInt(limit));

      const total = await Transaction.countDocuments(query);

      res.json({
        success: true,
        data: {
          transactions: transactions,
          pagination: {
            total: total,
            page: parseInt(page),
            limit: parseInt(limit),
            pages: Math.ceil(total / parseInt(limit))
          }
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get single transaction by ID
   */
  static async getTransaction(req, res, next) {
    try {
      const { id } = req.params;
      const userId = req.user._id;

      const transaction = await Transaction.findOne({
        _id: id,
        userId: userId
      });

      if (!transaction) {
        return res.status(404).json({
          success: false,
          message: 'Transaction not found'
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
   * Get transaction statistics
   */
  static async getStatistics(req, res, next) {
    try {
      const userId = req.user._id;

      const stats = await Transaction.aggregate([
        { $match: { userId: userId } },
        {
          $group: {
            _id: null,
            totalTransactions: { $sum: 1 },
            totalUSD: { $sum: '$amountUSD' },
            totalUSDT: { $sum: '$usdtAmount' },
            completedCount: {
              $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
            },
            failedCount: {
              $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] }
            }
          }
        }
      ]);

      const statistics = stats[0] || {
        totalTransactions: 0,
        totalUSD: 0,
        totalUSDT: 0,
        completedCount: 0,
        failedCount: 0
      };

      // Get recent transactions
      const recentTransactions = await Transaction.find({ userId })
        .sort({ createdAt: -1 })
        .limit(5);

      res.json({
        success: true,
        data: {
          statistics: statistics,
          recentTransactions: recentTransactions
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get all transactions (admin only)
   */
  static async getAllTransactions(req, res, next) {
    try {
      const { status, page = 1, limit = 20 } = req.query;

      const query = status ? { status } : {};

      const transactions = await Transaction.find(query)
        .populate('userId', 'email fullName')
        .sort({ createdAt: -1 })
        .limit(parseInt(limit))
        .skip((parseInt(page) - 1) * parseInt(limit));

      const total = await Transaction.countDocuments(query);

      res.json({
        success: true,
        data: {
          transactions: transactions,
          pagination: {
            total: total,
            page: parseInt(page),
            limit: parseInt(limit),
            pages: Math.ceil(total / parseInt(limit))
          }
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get admin statistics
   */
  static async getAdminStatistics(req, res, next) {
    try {
      const stats = await Transaction.aggregate([
        {
          $group: {
            _id: null,
            totalTransactions: { $sum: 1 },
            totalRevenue: { $sum: '$conversionFee' },
            totalUSD: { $sum: '$amountUSD' },
            totalUSDT: { $sum: '$usdtAmount' },
            completedCount: {
              $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
            },
            failedCount: {
              $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] }
            }
          }
        }
      ]);

      const statistics = stats[0] || {
        totalTransactions: 0,
        totalRevenue: 0,
        totalUSD: 0,
        totalUSDT: 0,
        completedCount: 0,
        failedCount: 0
      };

      res.json({
        success: true,
        data: statistics
      });
    } catch (error) {
      next(error);
    }
  }
}

export default TransactionController;
