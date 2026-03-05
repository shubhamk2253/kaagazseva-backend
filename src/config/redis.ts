import Redis from 'ioredis';
import { env } from './env';
import logger from '../core/logger';

/**
 * KAAGAZSEVA - Redis Layer
 * Supports:
 * - OTP storage
 * - Rate limiting
 * - BullMQ queues
 * - Assignment locks
 */

export const redis = new Redis(env.REDIS_URL, {

  lazyConnect: true,

  maxRetriesPerRequest: null,

  enableReadyCheck: false,

  enableOfflineQueue: false,

  connectTimeout: 10000,

  retryStrategy: (times: number) => {

    if (times > 20) {
      logger.error('Redis retry attempts exceeded');
      return null; // stop retrying
    }

    const delay = Math.min(times * 200, 5000);

    return delay;
  },

  tls: env.REDIS_URL.startsWith('rediss://') ? {} : undefined,

});

///////////////////////////////////////////////////////////
// REDIS EVENT LOGGING
///////////////////////////////////////////////////////////

redis.on('connect', () => {

  logger.info({
    event: 'REDIS_CONNECTING'
  });

});

redis.on('ready', () => {

  logger.info({
    event: 'REDIS_READY'
  });

});

redis.on('error', (err) => {

  logger.error({
    event: 'REDIS_ERROR',
    error: err.message
  });

});

redis.on('reconnecting', () => {

  logger.warn({
    event: 'REDIS_RECONNECTING'
  });

});

///////////////////////////////////////////////////////////
// GRACEFUL SHUTDOWN
///////////////////////////////////////////////////////////

const shutdown = async () => {

  try {

    logger.info('Closing Redis connection...');

    await redis.quit();

    logger.info('Redis connection closed');

  } catch (error) {

    logger.error('Redis shutdown failed');

  }

};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);