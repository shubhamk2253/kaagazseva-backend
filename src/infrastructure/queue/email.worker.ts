import { Worker, Job } from 'bullmq';
import { Resend } from 'resend';
import { redis } from '../../config/redis';
import { env } from '../../config/env';
import logger from '../../core/logger';
import { EmailJobPayload } from './queue.service';

/**
 * KAAGAZSEVA - Email Background Worker
 * Provider: Resend (resend.com)
 * Queue: email-queue (BullMQ + Redis)
 */

const WORKER_NAME = 'email-worker';

// Resend client — lazy init
const resend = env.RESEND_API_KEY
  ? new Resend(env.RESEND_API_KEY)
  : null;

/* =====================================================
   TEMPLATE RENDERER
   Simple {{variable}} replacement
===================================================== */

function renderTemplate(
  template: string,
  context: Record<string, any> = {}
): string {
  return template.replace(
    /\{\{(\w+)\}\}/g,
    (_, key) => String(context[key] ?? '')
  );
}

/* =====================================================
   WORKER FACTORY
   Called from app.ts or jobs/index.ts
   NOT executed on import
===================================================== */

export function createEmailWorker() {

  const worker = new Worker<EmailJobPayload>(
    'email-queue',

    async (job: Job<EmailJobPayload>) => {
      const { to, subject, template, context } = job.data;

      if (!to || !subject) {
        logger.warn({
          event:  'EMAIL_JOB_INVALID',
          jobId:  job.id,
          reason: 'Missing to or subject',
        });
        return; // don't retry invalid jobs
      }

      logger.info({
        event:   'EMAIL_JOB_PROCESSING',
        worker:  WORKER_NAME,
        jobId:   job.id,
        to,
        attempt: job.attemptsMade + 1,
      });

      try {

        if (!resend) {
          // In dev without Resend key — log and skip
          logger.warn({
            event:  'EMAIL_SKIPPED',
            reason: 'RESEND_API_KEY not configured',
            to,
            subject,
          });
          return;
        }

        const html = template
          ? renderTemplate(template, context || {})
          : `<p>${subject}</p>`;

        await resend.emails.send({
          from:    'KaagazSeva <noreply@kaagazseva.in>',
          to:      [to],
          subject: subject,
          html,
        });

        logger.info({
          event:  'EMAIL_SENT',
          worker: WORKER_NAME,
          jobId:  job.id,
          to,
        });

      } catch (error: any) {
        logger.error({
          event:  'EMAIL_JOB_FAILED',
          worker: WORKER_NAME,
          jobId:  job.id,
          error:  error.message,
        });

        throw error; // triggers BullMQ retry
      }
    },

    {
      connection:   redis,
      concurrency:  5,
      lockDuration: 30000,
    }
  );

  /* =====================================================
     WORKER EVENTS
  ===================================================== */

  worker.on('completed', (job) => {
    logger.info({
      event: 'EMAIL_JOB_COMPLETED',
      jobId: job.id,
    });
  });

  worker.on('failed', (job, err) => {
    logger.error({
      event: 'EMAIL_JOB_FAILED_FINAL',
      jobId: job?.id,
      error: err.message,
    });
  });

  worker.on('stalled', (jobId) => {
    logger.warn({
      event: 'EMAIL_JOB_STALLED',
      jobId,
    });
  });

  worker.on('error', (err) => {
    logger.error({
      event: 'EMAIL_WORKER_ERROR',
      error: err.message,
    });
  });

  logger.info({ event: 'EMAIL_WORKER_STARTED' });

  return worker;
}