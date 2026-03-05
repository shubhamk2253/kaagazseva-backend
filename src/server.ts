import http from 'http';
import app from './app';
import { prisma } from './config/database';
import { redis } from './config/redis';
import { NotificationWorker } from './modules/notification/notification.worker';
import { AssignmentScheduler } from './modules/assignment/assignment.scheduler';
import { EscrowAutoReleaseScheduler } 
from './modules/escrow/escrow.autoRelease.scheduler';
import logger from './core/logger';

const PORT = process.env.PORT ||6379;
app.listen(PORT)
/**
 * KAAGAZSEVA - Server Bootstrapper
 * Initializes infrastructure and starts the HTTP server.
 */

async function bootstrap() {
  try {
    logger.info('🔄 Starting KaagazSeva Backend...');

    //////////////////////////////////////////////////////
    // 1️⃣ Connect Database
    //////////////////////////////////////////////////////
    await prisma.$connect();
    logger.info('✅ PostgreSQL connected successfully');

    //////////////////////////////////////////////////////
    // 2️⃣ Connect Redis
    //////////////////////////////////////////////////////
    await redis.ping();
    logger.info('✅ Redis connected successfully');

    //////////////////////////////////////////////////////
    // 3️⃣ Start HTTP Server
    //////////////////////////////////////////////////////
    const server = http.createServer(app);

    server.listen(PORT, () => {
      logger.info(`🌍 Server running on port ${PORT}`);
      logger.info(`📡 API: http://localhost:${PORT}/api/v1`);

      //////////////////////////////////////////////////////
      // 🔥 Start Schedulers ONLY in Production
      //////////////////////////////////////////////////////
      if (process.env.NODE_ENV === 'production') {

        NotificationWorker.start();
        logger.info('🚀 Notification Worker initialized');

        AssignmentScheduler.start();
        logger.info('🕒 Assignment Scheduler started');

        EscrowAutoReleaseScheduler.start();
        logger.info('💰 Escrow Auto-Release Scheduler started');
      }
    });

    //////////////////////////////////////////////////////
    // 4️⃣ Graceful Shutdown
    //////////////////////////////////////////////////////
    const shutdown = async () => {
      logger.warn('⚠️ Graceful shutdown initiated...');

      server.close(async () => {
        await prisma.$disconnect();
        await redis.quit();
        logger.info('🛑 Server shut down cleanly');
        process.exit(0);
      });
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);

  } catch (error) {
    logger.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

bootstrap();