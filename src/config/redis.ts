import Redis from 'ioredis';
import { env } from './env';

/**
 * KAAGAZSEVA - Redis Layer
 * Production-ready configuration (Upstash compatible)
 */

export const redis = new Redis(env.REDIS_URL, {
  lazyConnect: true,
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,

  // 🔐 Required for Upstash TLS
  tls: env.REDIS_URL.startsWith('rediss://')
    ? {}
    : undefined,

  retryStrategy: (times) => {
    const delay = Math.min(times * 100, 3000);

    if (times > 10) {
      console.error('❌ Redis: Too many retry attempts');
      return null;
    }

    return delay;
  },
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
    process.exit(1);
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
    console.error('Redis disconnection error', error);
  }
};

redis.on('ready', () => {
  if (env.NODE_ENV === 'development') {
    console.log('⚡ Redis ready');
  }
});

redis.on('error', (err) => {
  console.error('❌ Redis error:', err.message);
});

redis.on('reconnecting', () => {
  console.warn('🔄 Redis reconnecting...');
});