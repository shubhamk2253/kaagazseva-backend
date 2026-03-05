import http from "http";
import app from "./app";

import { prisma } from "./config/database";
import { redis } from "./config/redis";

import { NotificationWorker } from "./modules/notification/notification.worker";
import { AssignmentScheduler } from "./modules/assignment/assignment.scheduler";
import { EscrowAutoReleaseScheduler } from "./modules/escrow/escrow.autoRelease.scheduler";

import logger from "./core/logger";

const PORT = Number(process.env.PORT) || 5000;

let server: http.Server;

/**
 * KAAGAZSEVA - Server Bootstrap
 */

async function bootstrap() {
  try {
    logger.info({
      event: "SERVER_BOOTSTRAP_START",
    });

    //////////////////////////////////////////////////////
    // DATABASE CONNECTION
    //////////////////////////////////////////////////////

    await prisma.$connect();

    logger.info({
      event: "POSTGRES_CONNECTED",
    });

    //////////////////////////////////////////////////////
    // REDIS CONNECTION
    //////////////////////////////////////////////////////

    try {
      await redis.connect();

      logger.info({
        event: "REDIS_CONNECTED",
      });
    } catch (redisError: any) {
      logger.warn({
        event: "REDIS_CONNECTION_FAILED",
        error: redisError?.message,
      });
    }

    //////////////////////////////////////////////////////
    // CREATE HTTP SERVER
    //////////////////////////////////////////////////////

    server = http.createServer(app);

    server.listen(PORT, () => {
      logger.info({
        event: "SERVER_STARTED",
        port: PORT,
        api: "/api/v1",
      });
    });

    //////////////////////////////////////////////////////
    // SERVER ERROR HANDLING
    //////////////////////////////////////////////////////

    server.on("error", (error: any) => {
      logger.error({
        event: "SERVER_ERROR",
        message: error?.message,
        stack: error?.stack,
      });

      process.exit(1);
    });

    //////////////////////////////////////////////////////
    // START BACKGROUND WORKERS
    //////////////////////////////////////////////////////

    const enableWorkers = process.env.ENABLE_WORKERS === "true";

    if (enableWorkers) {
      NotificationWorker.start();

      logger.info({
        event: "NOTIFICATION_WORKER_STARTED",
      });

      AssignmentScheduler.start();

      logger.info({
        event: "ASSIGNMENT_SCHEDULER_STARTED",
      });

      EscrowAutoReleaseScheduler.start();

      logger.info({
        event: "ESCROW_SCHEDULER_STARTED",
      });
    }

    //////////////////////////////////////////////////////
    // GRACEFUL SHUTDOWN
    //////////////////////////////////////////////////////

    const shutdown = async () => {
      logger.warn({
        event: "SERVER_SHUTDOWN_INIT",
      });

      try {
        server.close(async () => {
          await prisma.$disconnect();

          try {
            await redis.quit();
          } catch {}

          logger.info({
            event: "SERVER_SHUTDOWN_COMPLETE",
          });

          process.exit(0);
        });
      } catch (error: any) {
        logger.error({
          event: "SHUTDOWN_FAILED",
          message: error?.message,
          stack: error?.stack,
        });

        process.exit(1);
      }
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
  } catch (error: any) {
    logger.error({
      event: "BOOTSTRAP_FAILED",
      message: error?.message,
      stack: error?.stack,
    });

    console.error("BOOTSTRAP ERROR:", error);

    process.exit(1);
  }
}

bootstrap();