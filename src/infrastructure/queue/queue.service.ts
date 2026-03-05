import { Queue, JobsOptions } from 'bullmq';
import { redis } from '../../config/redis';
import logger from '../../core/logger';

/**
 * Queue Names
 */
const EMAIL_QUEUE = 'email-queue';
const NOTIFICATION_QUEUE = 'notification-queue';

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
 * Default Queue Job Options
 */
const defaultJobOptions: JobsOptions = {
  attempts: 3,

  backoff: {
    type: 'exponential',
    delay: 5000,
  },

  removeOnComplete: {
    age: 3600, // 1 hour
  },

  removeOnFail: {
    age: 86400, // 24 hours
  },
};

/**
 * KAAGAZSEVA - Background Queue Service
 * Handles async tasks such as Email and Notifications.
 */
export class QueueService {

  //////////////////////////////////////////////////////
  // QUEUE INSTANCES
  //////////////////////////////////////////////////////

  private static emailQueue = new Queue<EmailJobPayload>(
    EMAIL_QUEUE,
    {
      connection: redis,
      defaultJobOptions,
    }
  );

  private static notificationQueue = new Queue<NotificationJobPayload>(
    NOTIFICATION_QUEUE,
    {
      connection: redis,
      defaultJobOptions,
    }
  );

  //////////////////////////////////////////////////////
  // ADD EMAIL JOB
  //////////////////////////////////////////////////////

  static async addEmailJob(data: EmailJobPayload): Promise<void> {

    if (!data?.to || !data?.subject) {

      logger.warn({
        event: 'EMAIL_JOB_REJECTED',
        reason: 'missing_fields',
        data,
      });

      return;
    }

    try {

      const jobId = `email:${data.to}:${Date.now()}`;

      await this.emailQueue.add(
        'send-email',
        data,
        { jobId }
      );

      logger.info({
        event: 'EMAIL_JOB_ADDED',
        to: data.to,
        jobId,
      });

    } catch (error: any) {

      logger.error({
        event: 'EMAIL_QUEUE_ERROR',
        error: error.message,
      });

      throw error;
    }
  }

  //////////////////////////////////////////////////////
  // ADD NOTIFICATION JOB
  //////////////////////////////////////////////////////

  static async addNotificationJob(
    data: NotificationJobPayload
  ): Promise<void> {

    if (!data?.userId || !data?.message) {

      logger.warn({
        event: 'NOTIFICATION_JOB_REJECTED',
        reason: 'missing_fields',
        data,
      });

      return;
    }

    try {

      const jobId = `notification:${data.userId}:${Date.now()}`;

      await this.notificationQueue.add(
        'send-notification',
        data,
        { jobId }
      );

      logger.info({
        event: 'NOTIFICATION_JOB_ADDED',
        userId: data.userId,
        type: data.type,
        jobId,
      });

    } catch (error: any) {

      logger.error({
        event: 'NOTIFICATION_QUEUE_ERROR',
        error: error.message,
      });

      throw error;
    }
  }
}