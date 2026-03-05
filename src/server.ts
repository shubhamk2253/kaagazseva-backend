import http from 'http';
import app from './app';

import{ prisma }from './config/database';
import { redis } from './config/redis';

import { NotificationWorker } from './modules/notification/notification.worker';
import { AssignmentScheduler } from './modules/assignment/assignment.scheduler';
import { EscrowAutoReleaseScheduler } from './modules/escrow/escrow.autoRelease.scheduler';

import logger from './core/logger';

const PORT = Number(process.env.PORT) || 5000;

let server: http.Server;

/**
 * KAAGAZSEVA - Server Bootstrap
 */

async function bootstrap() {

  try {

    logger.info({
      event: 'SERVER_BOOTSTRAP_START'
    });

    //////////////////////////////////////////////////////
    // DATABASE
    //////////////////////////////////////////////////////

    await prisma.$connect();

    logger.info({
      event: 'POSTGRES_CONNECTED'
    });

    //////////////////////////////////////////////////////
    // REDIS
    //////////////////////////////////////////////////////

    await redis.connect();

    logger.info({
      event: 'REDIS_CONNECTED'
    });

    //////////////////////////////////////////////////////
    // HTTP SERVER
    //////////////////////////////////////////////////////

    server = http.createServer(app);

    server.listen(PORT, () => {

      logger.info({
        event: 'SERVER_STARTED',
        port: PORT,
        api: `/api/v1`
      });

    });

    //////////////////////////////////////////////////////
    // SERVER ERROR HANDLING
    //////////////////////////////////////////////////////

    server.on('error', (error) => {

      logger.error({
        event: 'SERVER_ERROR',
        error
      });

      process.exit(1);

    });

    //////////////////////////////////////////////////////
    // START BACKGROUND SERVICES
    //////////////////////////////////////////////////////

    const enableWorkers =
      process.env.ENABLE_WORKERS === 'true';

    if (enableWorkers) {

      NotificationWorker.start();

      logger.info({
        event: 'NOTIFICATION_WORKER_STARTED'
      });

      AssignmentScheduler.start();

      logger.info({
        event: 'ASSIGNMENT_SCHEDULER_STARTED'
      });

      EscrowAutoReleaseScheduler.start();

      logger.info({
        event: 'ESCROW_SCHEDULER_STARTED'
      });

    }

    //////////////////////////////////////////////////////
    // GRACEFUL SHUTDOWN
    //////////////////////////////////////////////////////

    const shutdown = async () => {

      logger.warn({
        event: 'SERVER_SHUTDOWN_INIT'
      });

      try {

        server.close(async () => {

          await prisma.$disconnect();

          await redis.quit();

          logger.info({
            event: 'SERVER_SHUTDOWN_COMPLETE'
          });

          process.exit(0);

        });

      } catch (error) {

        logger.error({
          event: 'SHUTDOWN_FAILED',
          error
        });

        process.exit(1);

      }

    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);

  } catch (error) {

    logger.error({
      event: 'BOOTSTRAP_FAILED',
      error
    });

    process.exit(1);

  }

}

bootstrap();