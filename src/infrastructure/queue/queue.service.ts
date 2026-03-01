import { Queue, JobsOptions } from 'bullmq';
import {redis} from '../../config/redis';
import logger from '../../core/logger';

/**
 * Email Job Payload
 */
export interface EmailJobPayload {
  to: string;
  subject: string;
  template: string;
  context?: Record<string, unknown>;
}

/**
 * Notification Job Payload
 */
export interface NotificationJobPayload {
  userId: string;
  type: 'SMS' | 'PUSH';
  message: string;
}

/**
 * Common queue options
 */
const defaultJobOptions: JobsOptions = {
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 5000,
  },
  removeOnComplete: {
    age: 3600, // keep for 1 hour
  },
  removeOnFail: {
    age: 86400, // keep failed logs for 24 hours
  },
};

/**
 * KAAGAZSEVA - Background Queue Service
 * Handles async tasks (Email, Notifications, etc.)
 */
export class QueueService {
  private static emailQueue = new Queue('email-queue', {
    connection: redis,
    defaultJobOptions,
  });

  private static notificationQueue = new Queue('notification-queue', {
    connection: redis,
    defaultJobOptions,
  });

  /**
   * Add email job
   */
  static async addEmailJob(data: EmailJobPayload): Promise<void> {
    if (!data?.to || !data?.subject) {
      logger.warn('Email job rejected: missing required fields');
      return;
    }

    try {
      await this.emailQueue.add(
        'send-email',
        data,
        {
          jobId: `email:${data.to}:${Date.now()}`, // Prevent duplicates
        }
      );

      logger.info(`Email Job Added → to=${data.to}`);
    } catch (error) {
      logger.error(`Email Queue Error → ${error}`);
    }
  }

  /**
   * Add notification job
   */
  static async addNotificationJob(
    data: NotificationJobPayload
  ): Promise<void> {
    if (!data?.userId || !data?.message) {
      logger.warn('Notification job rejected: missing required fields');
      return;
    }

    try {
      await this.notificationQueue.add(
        'send-notification',
        data,
        {
          jobId: `notification:${data.userId}:${Date.now()}`,
        }
      );

      logger.info(
        `Notification Job Added → user=${data.userId} type=${data.type}`
      );
    } catch (error) {
      logger.error(`Notification Queue Error → ${error}`);
    }
  }
}