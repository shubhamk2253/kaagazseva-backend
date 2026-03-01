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
  // Prevent sending headers twice
  if (res.headersSent) {
    return next(error);
  }

  let err = error;

  /* ===============================
     1️⃣ Normalize Known Error Types
  ================================= */

  // Zod Validation Error
  if (error instanceof ZodError) {
    const message = error.errors.map(e => e.message).join(', ');
    err = new AppError(message, 400);
  }

  // Prisma Known Errors
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      err = new AppError('Duplicate field value entered.', 400);
    } else {
      err = new AppError('Database operation failed.', 400);
    }
  }

  // JWT Errors
  if (error instanceof TokenExpiredError) {
    err = new AppError('Session expired. Please login again.', 401);
  }

  if (error instanceof JsonWebTokenError) {
    err = new AppError('Invalid authentication token.', 401);
  }

  // If not AppError, convert to safe AppError
  if (!(err instanceof AppError)) {
    err = new AppError('Internal Server Error', 500, false);
  }

  const appError = err as AppError;

  /* ===============================
     2️⃣ Structured Logging
  ================================= */

  logger.error({
    message: appError.message,
    statusCode: appError.statusCode,
    requestId: req.requestId,
    method: req.method,
    path: req.originalUrl,
    userId: req.user?.userId ?? null,
    stack: env.NODE_ENV === 'development' ? appError.stack : undefined,
  });

  /* ===============================
     3️⃣ Development Mode Response
  ================================= */

  if (env.NODE_ENV === 'development') {
    return res.status(appError.statusCode).json({
      success: false,
      message: appError.message,
      stack: appError.stack,
      requestId: req.requestId,
    });
  }

  /* ===============================
     4️⃣ Production Safe Response
  ================================= */

  if (appError.isOperational) {
    return res.status(appError.statusCode).json({
      success: false,
      message: appError.message,
      requestId: req.requestId,
    });
  }

  return res.status(500).json({
    success: false,
    message: 'Something went very wrong. Please contact support.',
    requestId: req.requestId,
  });
};