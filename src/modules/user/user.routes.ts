import { Router } from 'express';
import { UserController } from './user.controller';
import { userSchema } from './user.schema';
import { validate } from '../../middleware/validate.middleware';
import { requireAuth } from '../../middleware/auth.middleware';
import { authorizeRoles } from '../../middleware/role.middleware';
import { apiLimiter } from '../../middleware/rateLimit.middleware';
import { UserRole } from '../../core/constants';

/**
 * KAAGAZSEVA - User Routes
 * Secure endpoints for profile management and administrative oversight.
 */
const router = Router();

/* ---------------------------------------
   AUTHENTICATED USER ROUTES
--------------------------------------- */

// All routes below require valid JWT
router.use(requireAuth);

/**
 * GET /api/v1/users/me
 */
router.get('/me', UserController.getMe);

/**
 * PATCH /api/v1/users/me
 */
router.patch(
  '/me',
  validate(userSchema.updateProfile),
  UserController.updateMe
);

/* ---------------------------------------
   STATE_ADMIN ONLY ROUTES
--------------------------------------- */

router.use(authorizeRoles(UserRole.STATE_ADMIN));

/**
 * GET /api/v1/users/admin/all
 */
router.get(
  '/admin/all',
  apiLimiter,
  validate(userSchema.searchUsers),
  UserController.adminGetAllUsers
);

/**
 * PATCH /api/v1/users/admin/:id/status
 */
router.patch(
  '/admin/:id/status',
  validate(userSchema.updateStatus),
  UserController.adminUpdateStatus
);

export default router;