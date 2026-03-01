import { Worker, Job } from 'bullmq';
import {redis} from '../../config/redis';
import logger from '../../core/logger';
import { EmailJobPayload } from './queue.service';

/**
 * KAAGAZSEVA - Email Background Worker
 * Processes email-queue jobs.
 */

const emailWorker = new Worker<EmailJobPayload>(
  'email-queue',
  async (job: Job<EmailJobPayload>) => {
    const { to, subject, template, context } = job.data;

    if (!to || !subject) {
      logger.warn(`Invalid email job payload → jobId=${job.id}`);
      return;
    }

    try {
      logger.info(
        `Email Processing → jobId=${job.id} to=${to} attempt=${job.attemptsMade + 1}`
      );

      /**
       * 🔌 EMAIL PROVIDER INTEGRATION
       * Replace with:
       * - Nodemailer
       * - SendGrid
       * - Amazon SES
       * - SMTP Provider
       */

      // Example simulation
      await new Promise((resolve) => setTimeout(resolve, 1500));

      logger.info(`Email Sent Successfully → jobId=${job.id} to=${to}`);

    } catch (error: any) {
      logger.error(
        `Email Job Failed → jobId=${job.id} error=${error.message}`
      );

      // Throw to trigger retry (BullMQ handles attempts/backoff)
      throw error;
    }
  },
  {
    connection: redis,
    concurrency: 5, // Parallel processing
  }
);

/**
 * Monitoring Events
 */
emailWorker.on('completed', (job) => {
  logger.info(`Email Job Completed → jobId=${job.id}`);
});

emailWorker.on('failed', (job, err) => {
  logger.error(
    `Email Job Failed Permanently → jobId=${job?.id} error=${err.message}`
  );
});

emailWorker.on('error', (err) => {
  logger.error(`Email Worker Error → ${err.message}`);
});

/**
 * Graceful Shutdown
 */
process.on('SIGTERM', async () => {
  logger.info('Shutting down Email Worker...');
  await emailWorker.close();
  process.exit(0);
});

export default emailWorker;