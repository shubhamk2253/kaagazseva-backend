import rateLimit from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import type { RedisReply } from 'rate-limit-redis';
import { redis } from '../config/redis';
import { AppError } from '../core/AppError';
import logger from '../core/logger';
import { Request, Response, NextFunction } from 'express';

/**
 * KAAGAZSEVA - Redis-backed Rate Limiter
 * Production-ready for Render / Reverse Proxies.
 */

/* ======================================================
   🔹 Proper Redis Command Adapter (FULLY TYPE SAFE)
====================================================== */

type RedisCommand = [
  command: string,
  ...args: (string | number | Buffer)[]
];

const sendCommand = (
  ...args: RedisCommand
): Promise<RedisReply> => {
  return redis.call(...args) as Promise<RedisReply>;
};

const redisStore = new RedisStore({
  sendCommand,
});

/* ======================================================
   🔹 1. Global API Limiter
====================================================== */

export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  store: redisStore,

  keyGenerator: (req: Request) => req.ip ?? 'unknown-ip',

  handler: (req: Request, _res: Response, next: NextFunction) => {
    logger.warn(`API Rate limit exceeded | IP: ${req.ip}`);
    next(
      new AppError(
        'Too many requests. Please try again after 15 minutes.',
        429
      )
    );
  },
});

/* ======================================================
   🔹 2. Strict Auth Limiter
====================================================== */

export const authLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,

  store: new RedisStore({
    sendCommand,
    prefix: 'rl-auth:',
  }),

  keyGenerator: (req: Request) => req.ip ?? 'unknown-ip',

  handler: (req: Request, _res: Response, next: NextFunction) => {
    logger.error(`⚠️ Brute force attempt detected | IP: ${req.ip}`);
    next(
      new AppError(
        'Too many authentication attempts. Please try again later.',
        429
      )
    );
  },
});