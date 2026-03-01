import rateLimit from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import type { Request } from 'express';
import {redis} from './redis';
import { AppError } from '../core/AppError';

/**
 * Redis Store Adapter
 * Proper typing wrapper to avoid ts-ignore hacks
 */
const redisStore = new RedisStore({
  sendCommand: (...args: string[]) => {
    return (redis as any).call(...args);
  },
});

/* =========================================================
   1️⃣ GLOBAL LIMITER (All Public APIs)
========================================================= */

export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300, // Increased for national scale
  standardHeaders: true,
  legacyHeaders: false,
  store: redisStore,

  keyGenerator: (req: Request) => {
    // Prefer real IP behind proxies
    return req.ip || req.socket.remoteAddress || 'unknown';
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
   2️⃣ AUTH LIMITER (OTP + Login)
========================================================= */

export const authLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 OTP attempts per hour per IP
  standardHeaders: true,
  legacyHeaders: false,
  store: redisStore,

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
   3️⃣ CRITICAL LIMITER (Financial / Withdrawals)
========================================================= */

export const criticalLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 20,
  store: redisStore,

  keyGenerator: (req: Request) => {
    // If logged in, rate limit per user instead of IP
    const userId = (req as any).user?.id;
    return userId || req.ip;
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