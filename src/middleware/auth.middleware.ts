import { Response, NextFunction, RequestHandler } from 'express';
import { createHash }    from 'crypto';
import { JwtService }    from '../modules/auth/jwt.service';
import { AppError, ErrorCodes } from '../core/AppError';
import { RequestWithUser }      from '../core/types';
import { UserRole }      from '@prisma/client';
import logger            from '../core/logger';
import { redis }         from '../config/redis';
import { prisma }        from '../config/database';

/**
 * KAAGAZSEVA - Authentication & Authorization Middleware
 * Auth: Email + Password + JWT
 */

/* =====================================================
   TOKEN EXTRACTION
===================================================== */

function extractToken(header?: string): string {
  if (!header) {
    throw new AppError('Authentication required.', 401, true, ErrorCodes.UNAUTHORIZED);
  }
  if (!header.startsWith('Bearer ')) {
    throw new AppError('Invalid authorization format.', 401, true, ErrorCodes.UNAUTHORIZED);
  }
  const token = header.substring(7);
  if (!token) {
    throw new AppError('Access token missing.', 401, true, ErrorCodes.UNAUTHORIZED);
  }
  return token;
}

/* =====================================================
   AUTHENTICATION
===================================================== */

export const requireAuth: RequestHandler = async (
  req: RequestWithUser,
  _res: Response,
  next: NextFunction
) => {
  try {

    // 1. Extract token from Authorization header
    const token   = extractToken(req.headers.authorization);

    // 2. Verify JWT signature + expiry
    const decoded = JwtService.verifyAccessToken(token);

    // 3. Check token blacklist (logout invalidation)
    const tokenHash      = createHash('sha256').update(token).digest('hex');
    const blacklistKey   = `blacklist:token:${tokenHash}`;
    const isBlacklisted  = await redis.get(blacklistKey);

    if (isBlacklisted) {
      throw new AppError(
        'Session invalidated. Please login again.',
        401, true, ErrorCodes.SESSION_EXPIRED
      );
    }

    // 4. Check user status (suspended/inactive)
    // Cached in Redis for 60s to reduce DB load
    const userStatusKey = `user:status:${decoded.userId}`;
    let userStatus = await redis.get(userStatusKey);

    if (!userStatus) {
      const user = await prisma.user.findUnique({
        where:  { id: decoded.userId },
        select: { isActive: true, isSuspended: true },
      });

      if (!user) {
        throw new AppError(
          'Account not found.',
          401, true, ErrorCodes.UNAUTHORIZED
        );
      }

      userStatus = JSON.stringify(user);
      await redis.set(userStatusKey, userStatus, 'EX', 60); // cache 60s
    }

    const { isActive, isSuspended } = JSON.parse(userStatus);

    if (!isActive) {
      throw new AppError(
        'Account is inactive.',
        401, true, ErrorCodes.USER_INACTIVE
      );
    }

    if (isSuspended) {
      throw AppError.userSuspended();
    }

    // 5. Attach user context to request
    req.user = decoded;

    return next();

  } catch (error) {
    return next(error);
  }
};

/* =====================================================
   ROLE AUTHORIZATION (RBAC)
===================================================== */

export const requireRole = (
  allowedRoles: UserRole[]
): RequestHandler => {
  return (
    req: RequestWithUser,
    _res: Response,
    next: NextFunction
  ) => {

    if (!req.user) {
      logger.error({
        event: 'AUTH_CONTEXT_MISSING',
        path:  req.originalUrl,
      });
      return next(
        new AppError('Authentication context missing.', 500)
      );
    }

    if (!allowedRoles.includes(req.user.role)) {
      logger.warn({
        event:  'ACCESS_DENIED',
        userId: req.user.userId,
        role:   req.user.role,
        path:   req.originalUrl,
      });
      return next(
        new AppError(
          'You do not have permission to perform this action.',
          403, true, ErrorCodes.FORBIDDEN
        )
      );
    }

    return next();
  };
};

/* =====================================================
   COMBINED HELPER
   requireAuth + requireRole in one call
===================================================== */

export const requireAuthRole = (
  ...roles: UserRole[]
): RequestHandler[] => [
  requireAuth,
  requireRole(roles),
];

/* =====================================================
   OPTIONAL AUTH
   Attaches user if token present, continues if not
   Use on public routes that behave differently when logged in
===================================================== */

export const optionalAuth: RequestHandler = async (
  req: RequestWithUser,
  _res: Response,
  next: NextFunction
) => {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      return next(); // no token — continue as guest
    }

    const token   = header.substring(7);
    const decoded = JwtService.verifyAccessToken(token);
    req.user      = decoded;

  } catch {
    // Invalid token — continue as guest, don't throw
  }
  return next();
};