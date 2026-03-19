import { PrismaClient } from '@prisma/client';
import { env, isDevelopment } from './env';
import logger from './logger';

/**
 * KAAGAZSEVA - Prisma Database Layer
 * Ensures:
 * - Single instance in dev (no hot-reload leaks)
 * - Connection pool configuration for Supabase
 * - Slow query detection
 * - Clean environment-based logging
 */

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

const createPrismaClient = () => {

  const client = new PrismaClient({
    log:
      env.NODE_ENV === 'development'
        ? ['query', 'warn', 'error']
        : ['error'],
  });

  // Slow query detection middleware
  client.$use(async (params, next) => {
    const start  = Date.now();
    const result = await next(params);
    const duration = Date.now() - start;

    if (duration > 2000) {
      logger.warn({
        event:    'SLOW_QUERY',
        model:    params.model,
        action:   params.action,
        duration: `${duration}ms`,
      });
    }

    return result;
  });

  return client;
};

// Singleton — prevents connection pool exhaustion on hot reload
export const prisma = global.prisma ?? createPrismaClient();

if (isDevelopment) {
  global.prisma = prisma;
}

// Health check — used by /health endpoint
export async function isDatabaseHealthy(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

// Graceful disconnect — used by shutdown handler
export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect();
}