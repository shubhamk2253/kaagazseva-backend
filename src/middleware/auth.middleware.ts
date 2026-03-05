import { Response, NextFunction, RequestHandler } from 'express';
import { JwtService } from '../infrastructure/jwt/jwt.service';
import { AppError } from '../core/AppError';
import { RequestWithUser } from '../core/types';
import { UserRole } from '@prisma/client';
import logger from '../core/logger';
import { redis } from '../config/redis';

/**
 * KAAGAZSEVA - Authentication & Authorization Middleware
 */

///////////////////////////////////////////////////////////
// TOKEN EXTRACTION
///////////////////////////////////////////////////////////

function extractToken(header?: string): string {

  if (!header) {
    throw new AppError(
      'Authentication required.',
      401
    );
  }

  if (!header.startsWith('Bearer ')) {
    throw new AppError(
      'Invalid authorization format.',
      401
    );
  }

  const token = header.substring(7);

  if (!token) {
    throw new AppError(
      'Access token missing.',
      401
    );
  }

  return token;
}

///////////////////////////////////////////////////////////
// AUTHENTICATION
///////////////////////////////////////////////////////////

export const requireAuth: RequestHandler = async (
  req: RequestWithUser,
  _res: Response,
  next: NextFunction
) => {

  try {

    //////////////////////////////////////////////////////
    // Extract token
    //////////////////////////////////////////////////////

    const token = extractToken(req.headers.authorization);

    //////////////////////////////////////////////////////
    // Verify token
    //////////////////////////////////////////////////////

    const decoded = JwtService.verifyAccessToken(token);

    //////////////////////////////////////////////////////
    // Token blacklist check
    //////////////////////////////////////////////////////

    const blacklistKey = `blacklist:${decoded.userId}`;

    const isBlacklisted = await redis.get(blacklistKey);

    if (isBlacklisted === token) {

      throw new AppError(
        'Session invalidated. Please login again.',
        401
      );

    }

    //////////////////////////////////////////////////////
    // Attach user context
    //////////////////////////////////////////////////////

    req.user = decoded;

    return next();

  } catch (error) {

    return next(error);

  }

};

///////////////////////////////////////////////////////////
// ROLE AUTHORIZATION (RBAC)
///////////////////////////////////////////////////////////

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
        path: req.originalUrl
      });

      return next(
        new AppError(
          'Authentication context missing.',
          500
        )
      );

    }

    if (!allowedRoles.includes(req.user.role)) {

      logger.warn({
        event: 'ACCESS_DENIED',
        userId: req.user.userId,
        role: req.user.role,
        path: req.originalUrl
      });

      return next(
        new AppError(
          'You do not have permission to perform this action.',
          403
        )
      );

    }

    return next();

  };

};