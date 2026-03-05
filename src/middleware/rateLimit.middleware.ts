import rateLimit from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import type { RedisReply } from 'rate-limit-redis';
import { redis } from '../config/redis';
import { AppError } from '../core/AppError';
import logger from '../core/logger';
import { Request, Response, NextFunction } from 'express';

/**
 * KAAGAZSEVA - Redis-backed Rate Limiter
 */

///////////////////////////////////////////////////////////
// REDIS COMMAND ADAPTER
///////////////////////////////////////////////////////////

type RedisCommand = [
  command: string,
  ...args: (string | number | Buffer)[]
];

const sendCommand = (
  ...args: RedisCommand
): Promise<RedisReply> => {
  return redis.call(...args) as Promise<RedisReply>;
};

///////////////////////////////////////////////////////////
// CLIENT IDENTIFIER
///////////////////////////////////////////////////////////

function getClientIp(req: Request): string {

  const forwarded = req.headers['x-forwarded-for'];

  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }

  return req.ip ?? 'unknown-ip';
}

///////////////////////////////////////////////////////////
// GLOBAL API LIMITER
///////////////////////////////////////////////////////////

export const apiLimiter = rateLimit({

  windowMs: 15 * 60 * 1000,

  max: 100,

  standardHeaders: true,

  legacyHeaders: false,

  store: new RedisStore({
    sendCommand,
    prefix: 'rl-api:',
  }),

  keyGenerator: getClientIp,

  handler: (req: Request, _res: Response, next: NextFunction) => {

    logger.warn({
      event: 'RATE_LIMIT_API',
      ip: getClientIp(req),
      path: req.originalUrl
    });

    next(
      new AppError(
        'Too many requests. Please try again after 15 minutes.',
        429
      )
    );
  },

});

///////////////////////////////////////////////////////////
// AUTH LIMITER (OTP / LOGIN)
///////////////////////////////////////////////////////////

export const authLimiter = rateLimit({

  windowMs: 60 * 60 * 1000,

  max: 5,

  standardHeaders: true,

  legacyHeaders: false,

  store: new RedisStore({
    sendCommand,
    prefix: 'rl-auth:',
  }),

  keyGenerator: getClientIp,

  handler: (req: Request, _res: Response, next: NextFunction) => {

    logger.error({
      event: 'RATE_LIMIT_AUTH',
      ip: getClientIp(req),
      path: req.originalUrl
    });

    next(
      new AppError(
        'Too many authentication attempts. Please try again later.',
        429
      )
    );
  },

});

///////////////////////////////////////////////////////////
// CRITICAL LIMITER (FINANCIAL APIs)
///////////////////////////////////////////////////////////

export const criticalLimiter = rateLimit({

  windowMs: 10 * 60 * 1000,

  max: 20,

  standardHeaders: true,

  legacyHeaders: false,

  store: new RedisStore({
    sendCommand,
    prefix: 'rl-critical:',
  }),

  keyGenerator: getClientIp,

  handler: (req: Request, _res: Response, next: NextFunction) => {

    logger.error({
      event: 'RATE_LIMIT_CRITICAL',
      ip: getClientIp(req),
      path: req.originalUrl
    });

    next(
      new AppError(
        'Too many sensitive requests. Please slow down.',
        429
      )
    );
  },

});