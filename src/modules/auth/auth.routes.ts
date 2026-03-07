import { Router } from 'express';
import { AuthController } from './auth.controller';
import { authSchema } from './auth.schema';
import { validate } from '../../middleware/validate.middleware';
import { authLimiter, apiLimiter } from '../../middleware/rateLimit.middleware';

/**
 * KAAGAZSEVA - Auth Routes
 */
const router = Router();

/**
 * @route   POST /api/v1/auth/request-otp
 * @desc    Request a 6-digit OTP
 * @access  Public (Strict Rate Limited)
 */
router.post(
  '/request-otp',
 // 🔐 Protect against OTP spam
  validate(authSchema.requestOtp),
  AuthController.requestOtp
);

/**
 * @route   POST /api/v1/auth/verify-otp
 * @desc    Verify OTP and issue tokens
 * @access  Public
 */
router.post(
  '/verify-otp',
  apiLimiter, // Standard API limit
  validate(authSchema.verifyOtp),
  AuthController.verifyOtp
);

/**
 * @route   POST /api/v1/auth/refresh
 * @desc    Refresh Access Token
 * @access  Public
 */
router.post(
  '/refresh',
  apiLimiter,
  validate(authSchema.refreshToken),
  AuthController.refreshToken
);

/**
 * @route   POST /api/v1/auth/logout
 * @desc    Logout user
 */
router.post(
  '/logout',
  apiLimiter,
  AuthController.logout
);

export default router;