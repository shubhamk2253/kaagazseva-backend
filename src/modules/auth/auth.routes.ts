import { Router }           from 'express';
import { AuthController }   from './auth.controller';
import { authSchema }       from './auth.schema';
import { validate }         from '../../middleware/validate.middleware';
import { authLimiter }      from '../../middleware/rateLimit.middleware';
import { requireAuth }      from '../../middleware/auth.middleware';

/**
 * KAAGAZSEVA - Auth Routes
 * Email + Password authentication
 * Base: /api/v1/auth
 */

const router = Router();

/* =====================================================
   PUBLIC ROUTES
===================================================== */

// POST /api/v1/auth/register
router.post(
  '/register',
  authLimiter,
  validate(authSchema.register),
  AuthController.register
);

// POST /api/v1/auth/login
router.post(
  '/login',
  authLimiter,
  validate(authSchema.login),
  AuthController.login
);

// POST /api/v1/auth/refresh
router.post(
  '/refresh',
  validate(authSchema.refreshToken),
  AuthController.refreshToken
);

/* =====================================================
   PROTECTED ROUTES — requireAuth
===================================================== */

// POST /api/v1/auth/logout
router.post(
  '/logout',
  requireAuth,
  AuthController.logout
);

// GET /api/v1/auth/me
router.get(
  '/me',
  requireAuth,
  AuthController.me
);

// POST /api/v1/auth/change-password
router.post(
  '/change-password',
  requireAuth,
  validate(authSchema.changePassword),
  AuthController.changePassword
);

export default router;