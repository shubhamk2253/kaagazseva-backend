import rateLimit from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import type { Request } from 'express';
import { redis } from '../config/redis';
import { AppError } from '../core/AppError';
import { isDevelopment } from '../config/env';

/* =====================================================
   REDIS STORE
===================================================== */

const redisStore = new RedisStore({
  sendCommand: (...args: string[]) =>
    (redis as any).sendCommand(args),
});

/* =====================================================
   HELPERS
===================================================== */

function getClientIp(req: Request): string {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  return ip.replace(/^::ffff:/, '');
}

function getUserId(req: Request): string | null {
  return (req as any).user?.userId || null;
}

/* =====================================================
   GLOBAL / API LIMITER
   Applied to all routes in app.ts
===================================================== */

export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDevelopment ? 1000 : 300,
  standardHeaders: true,
  legacyHeaders: false,
  store: redisStore,

  // Skip health checks and webhooks
  skip: (req: Request) =>
    req.path === '/health' ||
    req.path.includes('/webhook'),

  keyGenerator: (req: Request) => getClientIp(req),

  handler: (_req, _res, next) => {
    next(new AppError(
      'Too many requests from this IP. Please try again later.',
      429
    ));
  },
});

// Alias
export const globalLimiter = apiLimiter;

/* =====================================================
   AUTH LIMITER
   Login, OTP send, OTP verify
   Keyed by: identity (phone/email) + IP
===================================================== */

export const authLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: isDevelopment ? 100 : 10,
  standardHeaders: true,
  legacyHeaders: false,
  store: redisStore,

  keyGenerator: (req: Request) => {
    const ip = getClientIp(req);
    const identifier =
      (req.body?.phoneNumber as string) ||
      (req.body?.email as string) ||
      'anonymous';
    return `auth_${identifier}_${ip}`;
  },

  handler: (_req, _res, next) => {
    next(new AppError(
      'Too many authentication attempts. Please try again in a few minutes.',
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
  max: isDevelopment ? 100 : 20,
  standardHeaders: true,
  legacyHeaders: false,
  store: redisStore,

  keyGenerator: (req: Request) => {
    const userId = getUserId(req);
    return `critical_${userId || getClientIp(req)}`;
  },

  handler: (_req, _res, next) => {
    next(new AppError(
      'Too many sensitive operations attempted. Please slow down.',
      429
    ));
  },
});

/* =====================================================
   PAYMENT LIMITER
   Create order, verify payment
   10 attempts per hour per user
===================================================== */

export const paymentLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: isDevelopment ? 100 : 10,
  standardHeaders: true,
  legacyHeaders: false,
  store: redisStore,

  keyGenerator: (req: Request) => {
    const userId = getUserId(req);
    return `payment_${userId || getClientIp(req)}`;
  },

  handler: (_req, _res, next) => {
    next(new AppError(
      'Too many payment attempts. Please try again later.',
      429
    ));
  },
});

/* =====================================================
   UPLOAD LIMITER
   Document uploads to S3
   20 uploads per hour per user
===================================================== */

export const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: isDevelopment ? 200 : 20,
  standardHeaders: true,
  legacyHeaders: false,
  store: redisStore,

  keyGenerator: (req: Request) => {
    const userId = getUserId(req);
    return `upload_${userId || getClientIp(req)}`;
  },

  handler: (_req, _res, next) => {
    next(new AppError(
      'Too many file uploads. Please try again later.',
      429
    ));
  },
});

/* =====================================================
   REFUND LIMITER
   Refund requests
   5 per day per user — prevents abuse
===================================================== */

export const refundLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  max: isDevelopment ? 100 : 5,
  standardHeaders: true,
  legacyHeaders: false,
  store: redisStore,

  keyGenerator: (req: Request) => {
    const userId = getUserId(req);
    return `refund_${userId || getClientIp(req)}`;
  },

  handler: (_req, _res, next) => {
    next(new AppError(
      'Too many refund requests. Please contact support.',
      429
    ));
  },
});