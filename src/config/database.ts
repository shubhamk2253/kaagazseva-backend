import { PrismaClient } from '@prisma/client';
import { env, isDevelopment } from './env';

/**
 * KAAGAZSEVA - Prisma Database Layer
 * Ensures:
 * - Single instance in dev (no hot-reload leaks)
 * - Clean logs
 * - Graceful shutdown
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

/**
 * Connect to database at startup
 */
export const connectDB = async () => {
  try {
    await prisma.$connect();
    console.log('🐘 Database connected successfully');
  } catch (error) {
    console.error('❌ Database connection failed');
    console.error(error);
    process.exit(1);
  }
};

/**
 * Graceful shutdown handler
 * Ensures no hanging connections in production
 */
export const disconnectDB = async () => {
  try {
    await prisma.$disconnect();
    console.log('🔌 Database disconnected gracefully');
  } catch (error) {
    console.error('Error during database disconnection', error);
  }
};

/**
 * Automatically handle shutdown signals
 */
process.on('SIGINT', async () => {
  await disconnectDB();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await disconnectDB();
  process.exit(0);
});