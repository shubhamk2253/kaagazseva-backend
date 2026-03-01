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
  // 1️⃣ Validate or generate request ID
  const incomingId = req.headers['x-request-id'];

  const requestId =
    typeof incomingId === 'string' && incomingId.length < 100
      ? incomingId
      : uuidv4();

  req.requestId = requestId;

  // 2️⃣ Attach to response header
  res.setHeader('x-request-id', requestId);

  // 3️⃣ Capture start time
  const startTime = Date.now();

  // 4️⃣ Log when response finishes
  res.on('finish', () => {
    const duration = Date.now() - startTime;

    logger.info(
      `HTTP ${req.method} ${req.originalUrl} → ${res.statusCode} | ${duration}ms | requestId=${requestId}`
    );
  });

  next();
};