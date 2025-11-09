import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import config from '../config/environment.js';
import logger from '../utils/logger.js';

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

      // Create new user
      const user = await User.create({
        email,
        password,
        fullName,
        walletAddress: walletAddress || null
      });

      // Generate JWT token
      const token = jwt.sign({ id: user._id }, config.jwt.secret, {
        expiresIn: config.jwt.expiresIn
      });

      logger.info('User registered successfully', { userId: user._id, email: user.email });

      res.status(201).json({
        success: true,
        message: 'User registered successfully',
        data: {
          user: user,
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
}

export default AuthController;
