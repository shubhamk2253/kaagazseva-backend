import { PrismaClient } from '@prisma/client';
import { env } from '../config/env';

/**
 * KAAGAZSEVA - Prisma Database Client
 * Ensures a single Prisma instance across the application.
 */

const globalForPrisma = global as unknown as {
  prisma: PrismaClient | undefined;
};

const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      env.NODE_ENV === 'development'
        ? ['query', 'info', 'warn', 'error']
        : ['error'],
  });

/**
 * Prevent multiple instances in development
 */
if (env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

/* =====================================================
   Graceful Shutdown Handling
===================================================== */

process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

export default prisma;