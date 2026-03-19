import { Queue, JobsOptions } from 'bullmq';
import { randomUUID } from 'crypto';
import { redis } from '../../config/redis';
import logger from '../../core/logger';

/**
 * KAAGAZSEVA - Background Queue Service
 * All async jobs flow through here.
 * Workers process jobs from these queues.
 */

/* =====================================================
   QUEUE NAMES — single source of truth
===================================================== */

export const QUEUE_NAMES = {
  EMAIL:        'email-queue',
  NOTIFICATION: 'notification-queue',
  ASSIGNMENT:   'assignment-queue',
  PAYMENT:      'payment-queue',
  ESCALATION:   'escalation-queue',
  FRAUD:        'fraud-queue',
} as const;

/* =====================================================
   JOB PAYLOADS
===================================================== */

export interface EmailJobPayload {
  to:       string;
  subject:  string;
  template: string;
  context?: Record<string, unknown>;
}

export interface NotificationJobPayload {
  userId:     string;
  type:       'PUSH' | 'EMAIL';   // SMS removed — no DLT
  title:      string;
  message:    string;
  fcmToken?:  string;             // required for PUSH
  data?:      Record<string, string>; // FCM data payload
  actionUrl?: string;             // deep link
}

export interface AssignmentJobPayload {
  applicationId: string;
  attemptNumber: number;
  districtId:    string;
  stateId:       string;
}

export interface PaymentJobPayload {
  type:          'RELEASE_ESCROW' | 'PROCESS_PAYOUT' | 'PROCESS_REFUND';
  applicationId: string;
  agentId?:      string;
  amount?:       number;
}

export interface EscalationJobPayload {
  applicationId: string;
  escalationLevel: number;
  reason:        string;
}

export interface FraudJobPayload {
  type:    'SCAN_AGENT' | 'SCAN_APPLICATION' | 'HOURLY_SCAN';
  agentId?: string;
  applicationId?: string;
}

/* =====================================================
   DEFAULT JOB OPTIONS
===================================================== */

const defaultJobOptions: JobsOptions = {
  attempts: 3,
  backoff: {
    type:  'exponential',
    delay: 5000, // 5s → 10s → 20s
  },
  removeOnComplete: { age: 3600  }, // clean after 1 hour
  removeOnFail:     { age: 86400 }, // keep failed 24 hours
};

// Critical jobs — more retries, kept longer
const criticalJobOptions: JobsOptions = {
  attempts: 5,
  backoff: {
    type:  'exponential',
    delay: 10000, // 10s → 20s → 40s → 80s → 160s
  },
  removeOnComplete: { age: 7200   }, // 2 hours
  removeOnFail:     { age: 604800 }, // 7 days
};

/* =====================================================
   QUEUE SERVICE
===================================================== */

export class QueueService {

  // Lazy queue instances
  private static _queues: Map<string, Queue> = new Map();

  private static getQueue<T>(name: string): Queue<T> {
    if (!this._queues.has(name)) {
      this._queues.set(name, new Queue<T>(name, {
        connection:        redis,
        defaultJobOptions,
      }));
    }
    return this._queues.get(name) as Queue<T>;
  }

  /* =====================================================
     EMAIL
  ===================================================== */

  static async addEmailJob(data: EmailJobPayload): Promise<void> {
    if (!data?.to || !data?.subject) {
      logger.warn({ event: 'EMAIL_JOB_REJECTED', reason: 'missing_fields' });
      return;
    }

    try {
      const jobId = `email:${data.to}:${randomUUID()}`;
      const queue = this.getQueue<EmailJobPayload>(QUEUE_NAMES.EMAIL);

      await queue.add('send-email', data, { jobId });

      logger.info({ event: 'EMAIL_JOB_ADDED', to: data.to, jobId });
    } catch (error: any) {
      logger.error({ event: 'EMAIL_QUEUE_ERROR', error: error.message });
      throw error;
    }
  }

  /* =====================================================
     PUSH NOTIFICATION
  ===================================================== */

  static async addNotificationJob(
    data: NotificationJobPayload
  ): Promise<void> {
    if (!data?.userId || !data?.message) {
      logger.warn({ event: 'NOTIFICATION_JOB_REJECTED', reason: 'missing_fields' });
      return;
    }

    try {
      const jobId = `notification:${data.userId}:${randomUUID()}`;
      const queue = this.getQueue<NotificationJobPayload>(QUEUE_NAMES.NOTIFICATION);

      await queue.add('send-notification', data, { jobId });

      logger.info({
        event:  'NOTIFICATION_JOB_ADDED',
        userId: data.userId,
        type:   data.type,
        jobId,
      });
    } catch (error: any) {
      logger.error({ event: 'NOTIFICATION_QUEUE_ERROR', error: error.message });
      throw error;
    }
  }

  /* =====================================================
     AGENT ASSIGNMENT — Critical
     Triggered immediately after payment captured
  ===================================================== */

  static async addAssignmentJob(
    data: AssignmentJobPayload
  ): Promise<void> {
    if (!data?.applicationId) {
      logger.warn({ event: 'ASSIGNMENT_JOB_REJECTED', reason: 'missing_applicationId' });
      return;
    }

    try {
      const jobId = `assignment:${data.applicationId}:${data.attemptNumber}`;
      const queue = this.getQueue<AssignmentJobPayload>(QUEUE_NAMES.ASSIGNMENT);

      await queue.add('assign-agent', data, {
        jobId,
        ...criticalJobOptions, // more retries for assignment
      });

      logger.info({
        event:         'ASSIGNMENT_JOB_ADDED',
        applicationId: data.applicationId,
        attempt:       data.attemptNumber,
        jobId,
      });
    } catch (error: any) {
      logger.error({ event: 'ASSIGNMENT_QUEUE_ERROR', error: error.message });
      throw error;
    }
  }

  /* =====================================================
     PAYMENT — Critical (escrow release, payouts)
  ===================================================== */

  static async addPaymentJob(data: PaymentJobPayload): Promise<void> {
    if (!data?.applicationId || !data?.type) {
      logger.warn({ event: 'PAYMENT_JOB_REJECTED', reason: 'missing_fields' });
      return;
    }

    try {
      const jobId = `payment:${data.type}:${data.applicationId}:${randomUUID()}`;
      const queue = this.getQueue<PaymentJobPayload>(QUEUE_NAMES.PAYMENT);

      await queue.add('process-payment', data, {
        jobId,
        ...criticalJobOptions,
      });

      logger.info({
        event:         'PAYMENT_JOB_ADDED',
        type:          data.type,
        applicationId: data.applicationId,
        jobId,
      });
    } catch (error: any) {
      logger.error({ event: 'PAYMENT_QUEUE_ERROR', error: error.message });
      throw error;
    }
  }

  /* =====================================================
     ESCALATION — Auto-escalation timers
  ===================================================== */

  static async addEscalationJob(
    data: EscalationJobPayload,
    delayMs: number = 0
  ): Promise<void> {
    try {
      const jobId = `escalation:${data.applicationId}:${data.escalationLevel}`;
      const queue = this.getQueue<EscalationJobPayload>(QUEUE_NAMES.ESCALATION);

      await queue.add('escalate', data, {
        jobId,
        delay: delayMs,
        ...defaultJobOptions,
      });

      logger.info({
        event:         'ESCALATION_JOB_ADDED',
        applicationId: data.applicationId,
        level:         data.escalationLevel,
        delayMs,
        jobId,
      });
    } catch (error: any) {
      logger.error({ event: 'ESCALATION_QUEUE_ERROR', error: error.message });
      throw error;
    }
  }

  /* =====================================================
     FRAUD SCAN
  ===================================================== */

  static async addFraudScanJob(data: FraudJobPayload): Promise<void> {
    try {
      const jobId = `fraud:${data.type}:${randomUUID()}`;
      const queue = this.getQueue<FraudJobPayload>(QUEUE_NAMES.FRAUD);

      await queue.add('fraud-scan', data, { jobId });

      logger.info({ event: 'FRAUD_JOB_ADDED', type: data.type, jobId });
    } catch (error: any) {
      logger.error({ event: 'FRAUD_QUEUE_ERROR', error: error.message });
      throw error;
    }
  }

  /* =====================================================
     CLOSE ALL QUEUES — called by graceful shutdown
  ===================================================== */

  static async closeAll(): Promise<void> {
    const closePromises = Array.from(this._queues.values()).map(q => q.close());
    await Promise.all(closePromises);
    logger.info({ event: 'ALL_QUEUES_CLOSED' });
  }
}