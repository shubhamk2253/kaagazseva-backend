import { Response, NextFunction, RequestHandler } from 'express';
import { RequestWithUser } from '../core/types';
import { UserRole } from '@prisma/client';
import { AppError } from '../core/AppError';
import logger from '../core/logger';

/**
 * KAAGAZSEVA - Role Authorization Middleware
 * Enforces strict RBAC permissions.
 *
 * Usage:
 *   authorizeRoles(UserRole.STATE_ADMIN)
 *   authorizeRoles(UserRole.STATE_ADMIN, UserRole.AGENT)
 */

const roleGuard =
  (...allowedRoles: UserRole[]): RequestHandler =>
  (req: RequestWithUser, _res: Response, next: NextFunction) => {

    //////////////////////////////////////////////////////
    // 1️⃣ Authentication Check
    //////////////////////////////////////////////////////

    if (!req.user) {

      logger.error({
        event: 'RBAC_AUTH_CONTEXT_MISSING',
        path: req.originalUrl,
        method: req.method,
        requestId: req.requestId
      });

      return next(
        new AppError(
          'Authentication context missing. Access denied.',
          401
        )
      );
    }

    //////////////////////////////////////////////////////
    // 2️⃣ Role Validation
    //////////////////////////////////////////////////////

    if (!allowedRoles.includes(req.user.role)) {

      logger.warn({
        event: 'RBAC_ACCESS_DENIED',
        userId: req.user.userId,
        role: req.user.role,
        allowedRoles,
        path: req.originalUrl,
        method: req.method,
        requestId: req.requestId
      });

      return next(
        new AppError(
          'You do not have permission to perform this action.',
          403
        )
      );
    }

    //////////////////////////////////////////////////////
    // 3️⃣ Authorized
    //////////////////////////////////////////////////////

    return next();
  };

/**
 * Primary export
 */
export const authorizeRoles = roleGuard;

/**
 * Backward compatibility alias
 */
export const requireRole = roleGuard;