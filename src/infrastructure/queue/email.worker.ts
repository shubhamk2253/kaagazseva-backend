import { Worker, Job } from 'bullmq';
import { redis } from '../../config/redis';
import logger from '../../core/logger';
import { EmailJobPayload } from './queue.service';

/**
 * KAAGAZSEVA - Email Background Worker
 * Handles email delivery via BullMQ queue.
 */

const WORKER_NAME = 'email-worker';

const emailWorker = new Worker<EmailJobPayload>(
  'email-queue',

  async (job: Job<EmailJobPayload>) => {

    const { to, subject, template, context } = job.data;

    if (!to || !subject) {
      logger.warn({
        event: 'EMAIL_JOB_INVALID',
        jobId: job.id,
      });
      return;
    }

    try {

      logger.info({
        event: 'EMAIL_JOB_PROCESSING',
        worker: WORKER_NAME,
        jobId: job.id,
        to,
        attempt: job.attemptsMade + 1,
      });

      //////////////////////////////////////////////////////
      // EMAIL PROVIDER INTEGRATION
      //////////////////////////////////////////////////////

      /**
       * Replace this with:
       * - Nodemailer
       * - SendGrid
       * - AWS SES
       */

      await new Promise((resolve) => setTimeout(resolve, 1500));

      //////////////////////////////////////////////////////
      // SUCCESS
      //////////////////////////////////////////////////////

      logger.info({
        event: 'EMAIL_SENT',
        worker: WORKER_NAME,
        jobId: job.id,
        to,
      });

    } catch (error: any) {

      logger.error({
        event: 'EMAIL_JOB_FAILED',
        worker: WORKER_NAME,
        jobId: job.id,
        error: error.message,
      });

      throw error; // BullMQ retry trigger
    }
  },

  {
    connection: redis,

    concurrency: 5,

    // Prevent stuck workers
    lockDuration: 30000,
  }
);

//////////////////////////////////////////////////////
// WORKER EVENTS
//////////////////////////////////////////////////////

emailWorker.on('completed', (job) => {
  logger.info({
    event: 'EMAIL_JOB_COMPLETED',
    jobId: job.id,
  });
});

emailWorker.on('failed', (job, err) => {
  logger.error({
    event: 'EMAIL_JOB_FAILED_FINAL',
    jobId: job?.id,
    error: err.message,
  });
});

emailWorker.on('stalled', (jobId) => {
  logger.warn({
    event: 'EMAIL_JOB_STALLED',
    jobId,
  });
});

emailWorker.on('error', (err) => {
  logger.error({
    event: 'EMAIL_WORKER_ERROR',
    error: err.message,
  });
});

//////////////////////////////////////////////////////
// GRACEFUL SHUTDOWN
//////////////////////////////////////////////////////

const shutdown = async () => {
  try {
    logger.info('Shutting down Email Worker...');
    await emailWorker.close();
    process.exit(0);
  } catch (error) {
    logger.error('Email Worker shutdown failed');
    process.exit(1);
  }
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

export default emailWorker;