import express from 'express';
import AuthController from '../controllers/authController.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { validate, schemas } from '../middleware/validation.middleware.js';

const router = express.Router();

// Public routes
router.post('/register', validate(schemas.register), AuthController.register);
router.post('/login', validate(schemas.login), AuthController.login);

// Protected routes
router.get('/me', authenticate, AuthController.getMe);
router.put('/profile', authenticate, validate(schemas.updateProfile), AuthController.updateProfile);
router.post('/logout', authenticate, AuthController.logout);

export default router;
