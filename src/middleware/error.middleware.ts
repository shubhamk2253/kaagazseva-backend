import { Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { JsonWebTokenError, TokenExpiredError } from 'jsonwebtoken';
import multer from 'multer';

import { AppError } from '../core/AppError';
import { RequestWithUser } from '../core/types';
import logger from '../core/logger';
import { env } from '../config/env';

async function notifyCriticalError(data: object) {
  try {
    if (!env.SLACK_WEBHOOK_URL) return;
    await fetch(env.SLACK_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: `🚨 KaagazSeva Critical Error\n\`\`\`${JSON.stringify(data, null, 2)}\`\`\``
      })
    });
  } catch {} // never crash on alert failure
}

export const errorMiddleware = (
  error: unknown,
  req: RequestWithUser,
  res: Response,
  next: NextFunction
) => {

  if (res.headersSent) {
    return next(error);
  }

  //////////////////////////////////////////////////////
  // NORMALIZE KNOWN ERRORS
  //////////////////////////////////////////////////////

  // Zod Validation — return field-level errors
  if (error instanceof ZodError) {
    const validationErrors = error.issues.map(issue => ({
      field:   issue.path.join('.'),
      message: issue.message,
      code:    issue.code,
    }));

    return res.status(400).json({
      success:  false,
      message:  'Validation failed',
      errors:   validationErrors,
      requestId: req.requestId,
      timestamp: new Date().toISOString(),
    });
  }

  let err: AppError;

  // Prisma Known Errors
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      case 'P2000': err = new AppError('Input value too long.',            400); break;
      case 'P2002': err = new AppError('Duplicate field value entered.',   409); break;
      case 'P2003': err = new AppError('Invalid relation reference.',      400); break;
      case 'P2006': err = new AppError('Invalid value provided.',          400); break;
      case 'P2011': err = new AppError('Required field cannot be empty.',  400); break;
      case 'P2014': err = new AppError('Invalid relation update.',         400); break;
      case 'P2025': err = new AppError('Requested record not found.',      404); break;
      case 'P2024': err = new AppError('Service busy. Please retry.',      503); break;
      default:      err = new AppError('Database operation failed.',       400);
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

  // Multer file upload
  else if (error instanceof multer.MulterError) {
    switch (error.code) {
      case 'LIMIT_FILE_SIZE':
        err = new AppError('File too large. Maximum 5MB allowed.', 400);
        break;
      case 'LIMIT_FILE_COUNT':
        err = new AppError('Too many files uploaded.', 400);
        break;
      case 'LIMIT_UNEXPECTED_FILE':
        err = new AppError('Unexpected file field.', 400);
        break;
      default:
        err = new AppError('File upload failed.', 400);
    }
  }

  // Already an AppError
  else if (error instanceof AppError) {
    err = error;
  }

  // Unknown — programming error, hide details
  else {
    err = new AppError('Internal Server Error', 500, false);
  }

  //////////////////////////////////////////////////////
  // STRUCTURED LOGGING
  //////////////////////////////////////////////////////

  logger.error({
    message:    err.message,
    statusCode: err.statusCode,
    requestId:  req.requestId,
    method:     req.method,
    path:       req.originalUrl,
    userId:     req.user?.userId ?? null,
    ip:         req.ip,
    userAgent:  req.headers['user-agent'],
    stack:      env.NODE_ENV === 'development' ? err.stack : undefined,
  });

  // Alert founder on critical errors
  if (err.statusCode === 500) {
    notifyCriticalError({
      message:   err.message,
      requestId: req.requestId,
      path:      `${req.method} ${req.originalUrl}`,
      userId:    req.user?.userId ?? null,
    });
  }

  //////////////////////////////////////////////////////
  // DEVELOPMENT RESPONSE
  //////////////////////////////////////////////////////

  if (env.NODE_ENV === 'development') {
    return res.status(err.statusCode).json({
      success:   false,
      message:   err.message,
      requestId: req.requestId,
      timestamp: new Date().toISOString(),
      stack:     err.stack,
    });
  }

  //////////////////////////////////////////////////////
  // PRODUCTION RESPONSE
  //////////////////////////////////////////////////////

  if (err.isOperational) {
    return res.status(err.statusCode).json({
      success:   false,
      message:   err.message,
      requestId: req.requestId,
      timestamp: new Date().toISOString(),
    });
  }

  return res.status(500).json({
    success:   false,
    message:   'Something went wrong. Please contact support.',
    requestId: req.requestId,
    timestamp: new Date().toISOString(),
  });
};