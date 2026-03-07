import rateLimit from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import type { Request } from 'express';
import { redis } from '../config/redis';
import { AppError } from '../core/AppError';

/**

* Redis Store Adapter
  */

const redisStore = new RedisStore({
sendCommand: (...args: string[]) => {
return (redis as any).sendCommand(args);
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
windowMs: 15 * 60 * 1000, // 15 minutes
max: 300, // 300 requests per IP
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
AUTH LIMITER (OTP + LOGIN)
========================================================= */

export const authLimiter = rateLimit({
windowMs: 10 * 60 * 1000, // 10 minutes window
max: 10, // max 10 OTP attempts
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
'Too many authentication attempts. Please try again in a few minutes.',
429
)
);
},
});

/* =========================================================
CRITICAL LIMITER
(Withdrawals, payments, sensitive actions)
========================================================= */

export const criticalLimiter = rateLimit({
windowMs: 10 * 60 * 1000, // 10 minutes
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