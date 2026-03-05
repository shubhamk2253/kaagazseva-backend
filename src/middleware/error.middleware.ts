import { Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { JsonWebTokenError, TokenExpiredError } from 'jsonwebtoken';

import { AppError } from '../core/AppError';
import { RequestWithUser } from '../core/types';
import logger from '../core/logger';
import { env } from '../config/env';

/**
 * KAAGAZSEVA - Global Error Middleware
 * Centralized error normalization & response control.
 */

export const errorMiddleware = (
  error: unknown,
  req: RequestWithUser,
  res: Response,
  next: NextFunction
) => {

  if (res.headersSent) {
    return next(error);
  }

  let err = error;

  //////////////////////////////////////////////////////
  // 1️⃣ NORMALIZE KNOWN ERRORS
  //////////////////////////////////////////////////////

  // Zod Validation
  if (error instanceof ZodError) {

    const message = error.issues.map(e => e.message).join(', ');
    err = new AppError(message, 400);

  }

  // Prisma Known Errors
  else if (error instanceof Prisma.PrismaClientKnownRequestError) {

    switch (error.code) {

      case 'P2002':
        err = new AppError('Duplicate field value entered.', 400);
        break;

      case 'P2025':
        err = new AppError('Requested record not found.', 404);
        break;

      case 'P2003':
        err = new AppError('Invalid relation reference.', 400);
        break;

      default:
        err = new AppError('Database operation failed.', 400);

    }

  }

  // Prisma Validation
  else if (error instanceof Prisma.PrismaClientValidationError) {

    err = new AppError('Invalid database query.', 400);

  }

  // JWT
  else if (error instanceof TokenExpiredError) {

    err = new AppError('Session expired. Please login again.', 401);

  }

  else if (error instanceof JsonWebTokenError) {

    err = new AppError('Invalid authentication token.', 401);

  }

  // Unknown errors
  if (!(err instanceof AppError)) {

    err = new AppError(
      'Internal Server Error',
      500,
      false
    );

  }

  const appError = err as AppError;

  //////////////////////////////////////////////////////
  // 2️⃣ STRUCTURED LOGGING
  //////////////////////////////////////////////////////

  logger.error({

    message: appError.message,
    statusCode: appError.statusCode,
    requestId: req.requestId,

    method: req.method,
    path: req.originalUrl,

    userId: req.user?.userId ?? null,

    ip: req.ip,
    userAgent: req.headers['user-agent'],

    stack:
      env.NODE_ENV === 'development'
        ? appError.stack
        : undefined,

  });

  //////////////////////////////////////////////////////
  // 3️⃣ DEVELOPMENT RESPONSE
  //////////////////////////////////////////////////////

  if (env.NODE_ENV === 'development') {

    return res.status(appError.statusCode).json({

      success: false,
      message: appError.message,
      requestId: req.requestId,
      timestamp: new Date().toISOString(),
      stack: appError.stack,

    });

  }

  //////////////////////////////////////////////////////
  // 4️⃣ PRODUCTION RESPONSE
  //////////////////////////////////////////////////////

  if (appError.isOperational) {

    return res.status(appError.statusCode).json({

      success: false,
      message: appError.message,
      requestId: req.requestId,
      timestamp: new Date().toISOString(),

    });

  }

  return res.status(500).json({

    success: false,
    message: 'Something went very wrong. Please contact support.',
    requestId: req.requestId,
    timestamp: new Date().toISOString(),

  });

};