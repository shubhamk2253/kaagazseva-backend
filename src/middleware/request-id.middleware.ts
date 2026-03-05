import { Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { RequestWithUser } from '../core/types';
import logger from '../core/logger';

/**
 * KAAGAZSEVA - Request Tracing Middleware
 * Assigns unique ID and logs lifecycle for observability.
 */
export const requestIdMiddleware = (
  req: RequestWithUser,
  res: Response,
  next: NextFunction
) => {
  const incomingId = req.headers['x-request-id'];

  const requestId =
    typeof incomingId === 'string' && incomingId.length < 100
      ? incomingId
      : uuidv4();

  req.requestId = requestId;

  res.setHeader('x-request-id', requestId);

  const startTime = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - startTime;

    logger.info({
      message: 'HTTP Request',
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      durationMs: duration,
      requestId,
    });
  });

  next();
};