import { PrismaClient } from '@prisma/client';
import { env, isDevelopment } from './env';

/**
 * KAAGAZSEVA - Prisma Database Layer
 * Ensures:
 * - Single instance in dev (no hot-reload leaks)
 * - Clean logs
 */

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

const createPrismaClient = () =>
  new PrismaClient({
    log:
      env.NODE_ENV === 'development'
        ? ['query', 'warn', 'error']
        : ['error'],
  });

export const prisma = global.prisma ?? createPrismaClient();

if (isDevelopment) {
  global.prisma = prisma;
}