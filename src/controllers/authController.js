import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import User from '../models/User.js';
import config from '../config/environment.js';
import logger from '../utils/logger.js';
import emailService from '../services/emailService.js';

class AuthController {
  /**
   * Register new user
   */
  static async register(req, res, next) {
    try {
      const { email, password, fullName, walletAddress } = req.body;

      // Check if user already exists
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'User already exists with this email'
        });
      }

      // Create new user with email auto-verified (email verification disabled)
      const user = await User.create({
        email,
        password,
        fullName,
        walletAddress: walletAddress || null,
        emailVerified: true  // Auto-verify to allow immediate login
      });

      // Email verification is DISABLED due to SMTP blocking on hosting
      // Optionally send welcome email (will fail silently if SMTP blocked)
      // try {
      //   const verificationCode = user.generateEmailVerificationToken();
      //   await user.save({ validateBeforeSave: false });
      //   await emailService.sendVerificationEmail(email, fullName, verificationCode);
      //   logger.info('Welcome email sent', { userId: user._id, email: user.email });
      // } catch (emailError) {
      //   logger.warn('Could not send welcome email (SMTP blocked)', {
      //     error: emailError.message,
      //     userId: user._id,
      //     email: user.email
      //   });
      // }

      // Generate JWT token for auto-login
      const token = jwt.sign({ id: user._id }, config.jwt.secret, {
        expiresIn: config.jwt.expiresIn
      });

      logger.info('User registered successfully (auto-verified)', { userId: user._id, email: user.email });

      res.status(201).json({
        success: true,
        message: 'Registration successful! You can now login.',
        data: {
          user: user.toJSON(),
          token: token
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Login user
   */
  static async login(req, res, next) {
    try {
      const { email, password } = req.body;

      // Find user and include password
      const user = await User.findOne({ email }).select('+password');

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Invalid credentials'
        });
      }

      // Check password
      const isPasswordValid = await user.comparePassword(password);

      if (!isPasswordValid) {
        return res.status(401).json({
          success: false,
          message: 'Invalid credentials'
        });
      }

      // Email verification is now OPTIONAL (disabled due to SMTP blocking on hosting)
      // Users can login without verifying their email
      // TODO: Re-enable when using a proper email service (SendGrid, Mailgun, etc.)
      // if (!user.emailVerified) {
      //   return res.status(403).json({
      //     success: false,
      //     message: 'Please verify your email before logging in',
      //     requiresVerification: true,
      //     email: user.email
      //   });
      // }

      // Generate JWT token
      const token = jwt.sign({ id: user._id }, config.jwt.secret, {
        expiresIn: config.jwt.expiresIn
      });

      logger.info('User logged in successfully', { userId: user._id, email: user.email });

      res.json({
        success: true,
        message: 'Login successful',
        data: {
          user: user.toJSON(),
          token: token
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get current user
   */
  static async getMe(req, res, next) {
    try {
      const user = await User.findById(req.user._id);

      res.json({
        success: true,
        data: {
          user: user
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update profile
   */
  static async updateProfile(req, res, next) {
    try {
      const { fullName, walletAddress } = req.body;

      const user = await User.findByIdAndUpdate(
        req.user._id,
        { fullName, walletAddress },
        { new: true, runValidators: true }
      );

      logger.info('User profile updated', { userId: user._id });

      res.json({
        success: true,
        message: 'Profile updated successfully',
        data: {
          user: user
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Logout user
   */
  static async logout(req, res, next) {
    try {
      res.json({
        success: true,
        message: 'Logout successful'
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Verify email with code
   */
  static async verifyEmail(req, res, next) {
    try {
      const { email, code } = req.body;

      if (!email || !code) {
        return res.status(400).json({
          success: false,
          message: 'Email and verification code are required'
        });
      }

      // Hash the provided code to compare with stored hash
      const hashedCode = crypto
        .createHash('sha256')
        .update(code)
        .digest('hex');

      // Find user with matching email and token
      const user = await User.findOne({
        email,
        emailVerificationToken: hashedCode,
        emailVerificationExpires: { $gt: Date.now() }
      }).select('+emailVerificationToken +emailVerificationExpires');

      if (!user) {
        return res.status(400).json({
          success: false,
          message: 'Invalid or expired verification code'
        });
      }

      // Update user
      user.emailVerified = true;
      user.emailVerificationToken = undefined;
      user.emailVerificationExpires = undefined;
      await user.save({ validateBeforeSave: false });

      // Generate JWT token
      const token = jwt.sign({ id: user._id }, config.jwt.secret, {
        expiresIn: config.jwt.expiresIn
      });

      logger.info('Email verified successfully', { userId: user._id, email: user.email });

      res.json({
        success: true,
        message: 'Email verified successfully! You can now login.',
        data: {
          user: user.toJSON(),
          token: token
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Resend verification email
   */
  static async resendVerification(req, res, next) {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({
          success: false,
          message: 'Email is required'
        });
      }

      // Find user
      const user = await User.findOne({ email });

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      if (user.emailVerified) {
        return res.status(400).json({
          success: false,
          message: 'Email is already verified'
        });
      }

      // Generate new verification code
      const verificationCode = user.generateEmailVerificationToken();
      await user.save({ validateBeforeSave: false });

      // Send verification email
      try {
        await emailService.sendVerificationEmail(email, user.fullName, verificationCode);
        logger.info('Verification email resent successfully', { userId: user._id, email: user.email });
      } catch (emailError) {
        logger.error('Failed to resend verification email', {
          error: emailError.message,
          userId: user._id,
          email: user.email
        });
        return res.status(500).json({
          success: false,
          message: 'Failed to send verification email. Please check server logs or contact support.'
        });
      }

      res.json({
        success: true,
        message: 'Verification code sent to your email'
      });
    } catch (error) {
      next(error);
    }
  }
}

export default AuthController;
