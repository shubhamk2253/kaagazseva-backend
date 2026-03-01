import {redis} from '../../config/redis';
import logger from '../../core/logger';
import { NotificationService } from './notification.service';
import { CreateNotificationInput } from './notification.types';

/**
 * KAAGAZSEVA - Notification Worker
 * Background processor for queued notifications.
 * Keeps API layer fast and non-blocking.
 */
export class NotificationWorker {
  private static readonly QUEUE_NAME = 'notifications:queue';
  private static isRunning = false;

  /* =====================================================
     START WORKER
  ===================================================== */
  static async start() {
    if (this.isRunning) {
      logger.warn('Notification Worker already running');
      return;
    }

    this.isRunning = true;
    logger.info('🚀 Notification Worker started. Listening for events...');

    while (this.isRunning) {
      try {
        /**
         * BLPOP blocks until an item is available.
         * Timeout = 0 → infinite block (efficient, no CPU waste)
         */
        const result = await redis.blpop(this.QUEUE_NAME, 0);

        if (!result) continue;

        const rawPayload = result[1];

        let payload: CreateNotificationInput;

        try {
          payload = JSON.parse(rawPayload);
        } catch (parseError) {
          logger.error('Invalid notification payload JSON:', rawPayload);
          continue;
        }

        await this.processNotification(payload);

      } catch (error) {
        logger.error('Notification Worker runtime error:', error);

        // Prevent tight error loop
        await new Promise((resolve) => setTimeout(resolve, 3000));
      }
    }
  }

  /* =====================================================
     STOP WORKER (Graceful Shutdown)
  ===================================================== */
  static stop() {
    this.isRunning = false;
    logger.info('🛑 Notification Worker stopped gracefully.');
  }

  /* =====================================================
     PROCESS NOTIFICATION
  ===================================================== */
  private static async processNotification(
    payload: CreateNotificationInput
  ) {
    const { userId, type, title, message, metadata } = payload;

    // 1️⃣ Save to DB (In-App Notification Center)
    await NotificationService.notify({
      userId,
      type,
      title,
      message,
      metadata,
    });

    // 2️⃣ Future Integrations (Phase 10+)
    // await EmailProvider.send(...)
    // await SMSProvider.send(...)
    // await FCMProvider.push(...)

    logger.info(
      `Processed notification | Type: ${type} | User: ${userId}`
    );
  }

  /* =====================================================
     ENQUEUE HELPER
     Used by ApplicationService, WalletService, TicketService
  ===================================================== */
  static async enqueue(payload: CreateNotificationInput) {
    try {
      await redis.rpush(this.QUEUE_NAME, JSON.stringify(payload));
    } catch (error) {
      logger.error('Failed to enqueue notification:', error);
    }
  }
}