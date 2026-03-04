import Redis from 'ioredis';
import { env } from './env';

/**
 * KAAGAZSEVA - Redis Layer (Upstash Compatible)
 */

export const redis = new Redis(env.REDIS_URL, {
  lazyConnect: true,

  maxRetriesPerRequest: null,
  enableReadyCheck: false,

  retryStrategy: (times) => {
    const delay = Math.min(times * 200, 5000);
    return delay;
  },

  tls: {}
});

/**
 * Connect Redis
 */
export const connectRedis = async () => {
  try {
    await redis.connect();
    console.log('⚡ Redis connected successfully');
  } catch (error) {
    console.error('❌ Redis connection failed');
    console.error(error);
  }
};

/**
 * Graceful shutdown
 */
export const disconnectRedis = async () => {
  try {
    await redis.quit();
    console.log('🔌 Redis disconnected gracefully');
  } catch (error) {
    console.error(error);
  }
};

redis.on('ready', () => {
  console.log('⚡ Redis ready');
});

redis.on('error', (err) => {
  console.error('❌ Redis error:', err.message);
});

redis.on('reconnecting', () => {
  console.warn('🔄 Redis reconnecting...');
});