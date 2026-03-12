import { Router } from 'express';
import { AuthController } from './auth.controller';
import { authSchema } from './auth.schema';
import { validate } from '../../middleware/validate.middleware';
import { apiLimiter } from '../../middleware/rateLimit.middleware';

/**
 * KAAGAZSEVA - Auth Routes
 * Firebase Authentication
 */

const router = Router();

//////////////////////////////////////////////////////
// FIREBASE LOGIN
//////////////////////////////////////////////////////

/**
 * @route   POST /api/v1/auth/firebase-login
 * @desc    Login using Firebase verified phone
 * @access  Public
 */

router.post(
  '/firebase-login',
  apiLimiter,
  validate(authSchema.firebaseLogin),
  AuthController.firebaseLogin
);

//////////////////////////////////////////////////////
// REFRESH TOKEN
//////////////////////////////////////////////////////

/**
 * @route   POST /api/v1/auth/refresh
 * @desc    Refresh Access Token
 */

router.post(
  '/refresh',
  apiLimiter,
  validate(authSchema.refreshToken),
  AuthController.refreshToken
);

//////////////////////////////////////////////////////
// LOGOUT
//////////////////////////////////////////////////////

/**
 * @route   POST /api/v1/auth/logout
 */

router.post(
  '/logout',
  apiLimiter,
  AuthController.logout
);

export default router;