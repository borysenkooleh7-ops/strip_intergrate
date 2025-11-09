import Joi from 'joi';
import logger from '../utils/logger.js';

/**
 * Generic validation middleware
 */
export const validate = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));

      logger.warn('Validation failed:', { errors });

      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors
      });
    }

    req.body = value;
    next();
  };
};

// Common validation schemas
export const schemas = {
  register: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().min(6).required(),
    fullName: Joi.string().min(2).max(100).required(),
    walletAddress: Joi.string().optional().allow(null, '')
  }),

  login: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required()
  }),

  createPayment: Joi.object({
    usdAmount: Joi.number().min(10).max(10000).required(),
    walletAddress: Joi.string().required().min(20).max(100),
    currency: Joi.string().valid('USD').default('USD'),
    network: Joi.string().valid('TRC20', 'ERC20', 'BEP20').default('TRC20')
  }),

  updateProfile: Joi.object({
    fullName: Joi.string().min(2).max(100).optional(),
    walletAddress: Joi.string().optional().allow(null, '')
  })
};
