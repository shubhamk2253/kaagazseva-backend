import rateLimit from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import type { Request } from 'express';
import { redis } from '../config/redis';
import { AppError } from '../core/AppError';

/**
 * Redis Store Adapter
 */

const redisStore = new RedisStore({
  sendCommand: (...args: (string | number)[]) => {
    return (redis as any).call(...args);
  },
});

/**
 * Normalize IP (remove IPv6 prefix)
 */

function getClientIp(req: Request): string {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  return ip.replace(/^::ffff:/, '');
}

/* =========================================================
   GLOBAL LIMITER
========================================================= */

export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  store: redisStore,

  keyGenerator: (req: Request) => {
    return getClientIp(req);
  },

  handler: (_req, _res, next) => {
    next(
      new AppError(
        'Too many requests from this IP. Please try again later.',
        429
      )
    );
  },
});

/* =========================================================
   AUTH LIMITER
========================================================= */

export const authLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  store: redisStore,

  keyGenerator: (req: Request) => {
    const ip = getClientIp(req);
    const identifier =
      (req.body?.phoneNumber as string) ||
      (req.body?.email as string) ||
      'anonymous';

    return `${identifier}_${ip}`;
  },

  handler: (_req, _res, next) => {
    next(
      new AppError(
        'Too many authentication attempts. Try again after 1 hour.',
        429
      )
    );
  },
});

/* =========================================================
   CRITICAL LIMITER
========================================================= */

export const criticalLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  store: redisStore,

  keyGenerator: (req: Request) => {
    const userId = (req as any).user?.userId;
    return userId || getClientIp(req);
  },

  handler: (_req, _res, next) => {
    next(
      new AppError(
        'Too many sensitive operations attempted. Please slow down.',
        429
      )
    );
  },
});