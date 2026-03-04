import { Response, NextFunction, RequestHandler } from 'express';
import { RequestWithUser } from '../core/types';
import { UserRole } from '@prisma/client';
import { AppError } from '../core/AppError';
import logger from '../core/logger';

/**
 * KAAGAZSEVA - Role Authorization Middleware
 * Strict RBAC enforcement layer.
 *
 * Usage:
 *  authorizeRoles(UserRole.STATE_ADMIN)
 *  authorizeRoles(UserRole.STATE_ADMIN, UserRole.AGENT)
 */

const roleGuard =
  (...allowedRoles: UserRole[]): RequestHandler =>
  (req: RequestWithUser, _res: Response, next: NextFunction) => {
    // 1️⃣ Failsafe: requireAuth must run before this
    if (!req.user) {
      logger.error(
        `[Security Error] Role middleware used without requireAuth | Path=${req.originalUrl}`
      );

      return next(
        new AppError('Authentication context missing. Access denied.', 401)
      );
    }

    // 2️⃣ Permission Check
    if (!allowedRoles.includes(req.user.role)) {
      logger.warn(
        `[RBAC Violation] User=${req.user.userId} Role=${req.user.role} Method=${req.method} Path=${req.originalUrl}`
      );

      return next(
        new AppError(
          'You do not have permission to perform this action.',
          403
        )
      );
    }

    // 3️⃣ Authorized
    return next();
  };

/**
 * Primary Export (Recommended)
 */
export const authorizeRoles = roleGuard;

/**
 * Backward Compatibility (If older routes use requireRole)
 */
export const requireRole = roleGuard;