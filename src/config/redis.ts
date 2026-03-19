import Redis from 'ioredis';
import { env } from './env';
import logger from '../core/logger';

/**
 * KAAGAZSEVA - Redis Layer
 * ioredis client with:
 * - Auto TLS detection for Render (rediss://)
 * - Exponential retry with ceiling
 * - BullMQ compatible (maxRetriesPerRequest: null)
 * - Graceful shutdown handled by app.ts
 */

export const redis = new Redis(env.REDIS_URL, {

  lazyConnect:          true,
  maxRetriesPerRequest: null,   // required for BullMQ
  enableReadyCheck:     false,
  enableOfflineQueue:   true,
  connectTimeout:       15000,  // 15s for Render cold starts

  retryStrategy: (times: number) => {
    if (times > 20) {
      logger.error({
        event:   'REDIS_RETRY_EXCEEDED',
        message: 'Redis gave up after 20 attempts',
      });
      return null; // stop retrying
    }
    return Math.min(times * 200, 5000); // max 5s between retries
  },

  // Auto TLS — Render Redis uses rediss://
  tls: env.REDIS_URL.startsWith('rediss://') ? {} : undefined,

});

///////////////////////////////////////////////////////////
// EVENT LOGGING
///////////////////////////////////////////////////////////

redis.on('connect', () => {
  logger.info({ event: 'REDIS_CONNECTING' });
});

redis.on('ready', () => {
  logger.info({ event: 'REDIS_READY' });
});

redis.on('error', (err) => {
  logger.error({
    event:   'REDIS_ERROR',
    message: err.message,
  });
});

redis.on('reconnecting', () => {
  logger.warn({ event: 'REDIS_RECONNECTING' });
});

redis.on('close', () => {
  logger.warn({ event: 'REDIS_CLOSED' });
});

redis.on('end', () => {
  logger.warn({ event: 'REDIS_CONNECTION_ENDED' });
});

///////////////////////////////////////////////////////////
// HEALTH CHECK — used by /health endpoint in app.ts
///////////////////////////////////////////////////////////

export async function isRedisHealthy(): Promise<boolean> {
  try {
    const result = await redis.ping();
    return result === 'PONG';
  } catch {
    return false;
  }
}

///////////////////////////////////////////////////////////
// GRACEFUL DISCONNECT — called by app.ts shutdown handler
// Do NOT add SIGINT/SIGTERM here — app.ts owns shutdown
///////////////////////////////////////////////////////////

export async function disconnectRedis(): Promise<void> {
  await redis.quit();
}