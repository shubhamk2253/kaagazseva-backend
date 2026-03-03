import { Response, NextFunction, RequestHandler } from 'express';
import { JwtService } from '../infrastructure/jwt/jwt.service';
import { AppError } from '../core/AppError';
import { RequestWithUser } from '../core/types';
import { UserRole } from '@prisma/client';
import logger from '../core/logger';
import { redis } from '../config/redis';

/**
 * KAAGAZSEVA - Authentication & Authorization Middleware
 * Enterprise-grade JWT protection with RBAC.
 */

///////////////////////////////////////////////////////////
// 1️⃣ AUTHENTICATION MIDDLEWARE
///////////////////////////////////////////////////////////

export const requireAuth: RequestHandler = async (
  req: RequestWithUser,
  _res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      throw new AppError('Authentication required. Please log in.', 401);
    }

    if (!authHeader.startsWith('Bearer ')) {
      throw new AppError('Invalid authorization header format.', 401);
    }

    const token = authHeader.split(' ')[1];

    if (!token) {
      throw new AppError('Access token missing.', 401);
    }

    ///////////////////////////////////////////////////////
    // 🔐 Verify Access Token
    ///////////////////////////////////////////////////////

    const decoded = JwtService.verifyAccessToken(token);

    ///////////////////////////////////////////////////////
    // 🔒 Token Blacklist Check (Redis)
    ///////////////////////////////////////////////////////

    const isBlacklisted = await redis.get(`blacklist:${token}`);

    if (isBlacklisted) {
      throw new AppError(
        'Session invalidated. Please log in again.',
        401
      );
    }

    ///////////////////////////////////////////////////////
    // Attach user context
    ///////////////////////////////////////////////////////

    req.user = decoded;

    return next();
  } catch (error) {
    return next(error);
  }
};

///////////////////////////////////////////////////////////
// 2️⃣ ROLE AUTHORIZATION MIDDLEWARE (RBAC)
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
      logger.error(
        `[Security Error] requireRole used without requireAuth on ${req.originalUrl}`
      );
      return next(
        new AppError('Authentication context missing.', 500)
      );
    }

    if (!allowedRoles.includes(req.user.role)) {
      logger.warn(
        `[Access Denied] User=${req.user.userId} Role=${req.user.role} Path=${req.originalUrl}`
      );

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