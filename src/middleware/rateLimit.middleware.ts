import rateLimit          from 'express-rate-limit';
import { RedisStore }     from 'rate-limit-redis';
import type { RedisReply } from 'rate-limit-redis';
import { redis }          from '../config/redis';
import { AppError }       from '../core/AppError';
import logger             from '../core/logger';
import { Request, Response, NextFunction } from 'express';
import { isDevelopment }  from '../config/env';

/**
 * KAAGAZSEVA - Redis-backed Rate Limiter
 * All limits are higher in development for easier testing.
 */

/* =====================================================
   REDIS ADAPTER
===================================================== */

type RedisCommand = [
  command: string,
  ...args: (string | number | Buffer)[]
];

const sendCommand = (
  ...args: RedisCommand
): Promise<RedisReply> => {
  return redis.call(...args) as Promise<RedisReply>;
};

/* =====================================================
   HELPERS
===================================================== */

function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req.ip ?? 'unknown-ip';
}

function getUserId(req: Request): string | null {
  return (req as any).user?.userId || null;
}

/* =====================================================
   GLOBAL API LIMITER
   Applied to all routes in app.ts
===================================================== */

export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max:      isDevelopment ? 1000 : 300,
  standardHeaders: true,
  legacyHeaders:   false,

  store: new RedisStore({ sendCommand, prefix: 'rl-api:' }),

  // Skip health checks and webhooks
  skip: (req: Request) =>
    req.path === '/health' ||
    req.path.includes('/webhook'),

  keyGenerator: getClientIp,

  handler: (req: Request, _res: Response, next: NextFunction) => {
    logger.warn({
      event: 'RATE_LIMIT_API',
      ip:    getClientIp(req),
      path:  req.originalUrl,
    });
    next(new AppError(
      'Too many requests. Please try again after 15 minutes.',
      429
    ));
  },
});

/* =====================================================
   AUTH LIMITER
   Login, register attempts
   Keyed by: email + IP
===================================================== */

export const authLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max:      isDevelopment ? 100 : 10,
  standardHeaders: true,
  legacyHeaders:   false,

  store: new RedisStore({ sendCommand, prefix: 'rl-auth:' }),

  keyGenerator: (req: Request) => {
    const ip         = getClientIp(req);
    const identifier = (req.body?.email as string) || 'anonymous';
    return `auth_${identifier}_${ip}`;
  },

  handler: (req: Request, _res: Response, next: NextFunction) => {
    logger.warn({
      event: 'RATE_LIMIT_AUTH',
      ip:    getClientIp(req),
      path:  req.originalUrl,
    });
    next(new AppError(
      'Too many authentication attempts. Please try again later.',
      429
    ));
  },
});

/* =====================================================
   CRITICAL LIMITER
   Withdrawals, sensitive account changes
   Keyed by: userId (authenticated)
===================================================== */

export const criticalLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max:      isDevelopment ? 100 : 20,
  standardHeaders: true,
  legacyHeaders:   false,

  store: new RedisStore({ sendCommand, prefix: 'rl-critical:' }),

  keyGenerator: (req: Request) => {
    const userId = getUserId(req);
    return `critical_${userId || getClientIp(req)}`;
  },

  handler: (req: Request, _res: Response, next: NextFunction) => {
    logger.warn({
      event: 'RATE_LIMIT_CRITICAL',
      ip:    getClientIp(req),
      path:  req.originalUrl,
    });
    next(new AppError(
      'Too many sensitive requests. Please slow down.',
      429
    ));
  },
});

/* =====================================================
   PAYMENT LIMITER
   Create order, verify payment
   10 per hour per user
===================================================== */

export const paymentLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max:      isDevelopment ? 100 : 10,
  standardHeaders: true,
  legacyHeaders:   false,

  store: new RedisStore({ sendCommand, prefix: 'rl-payment:' }),

  keyGenerator: (req: Request) => {
    const userId = getUserId(req);
    return `payment_${userId || getClientIp(req)}`;
  },

  handler: (req: Request, _res: Response, next: NextFunction) => {
    logger.warn({
      event: 'RATE_LIMIT_PAYMENT',
      ip:    getClientIp(req),
      path:  req.originalUrl,
    });
    next(new AppError(
      'Too many payment attempts. Please try again later.',
      429
    ));
  },
});

/* =====================================================
   UPLOAD LIMITER
   Document uploads to S3
   20 per hour per user
===================================================== */

export const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max:      isDevelopment ? 200 : 20,
  standardHeaders: true,
  legacyHeaders:   false,

  store: new RedisStore({ sendCommand, prefix: 'rl-upload:' }),

  keyGenerator: (req: Request) => {
    const userId = getUserId(req);
    return `upload_${userId || getClientIp(req)}`;
  },

  handler: (req: Request, _res: Response, next: NextFunction) => {
    logger.warn({
      event: 'RATE_LIMIT_UPLOAD',
      ip:    getClientIp(req),
      path:  req.originalUrl,
    });
    next(new AppError(
      'Too many file uploads. Please try again later.',
      429
    ));
  },
});

/* =====================================================
   REFUND LIMITER
   5 refund requests per day per user
===================================================== */

export const refundLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  max:      isDevelopment ? 100 : 5,
  standardHeaders: true,
  legacyHeaders:   false,

  store: new RedisStore({ sendCommand, prefix: 'rl-refund:' }),

  keyGenerator: (req: Request) => {
    const userId = getUserId(req);
    return `refund_${userId || getClientIp(req)}`;
  },

  handler: (req: Request, _res: Response, next: NextFunction) => {
    logger.warn({
      event: 'RATE_LIMIT_REFUND',
      ip:    getClientIp(req),
      path:  req.originalUrl,
    });
    next(new AppError(
      'Too many refund requests. Please contact support.',
      429
    ));
  },
});