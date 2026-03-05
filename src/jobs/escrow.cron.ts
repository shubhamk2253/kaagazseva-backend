import cron from 'node-cron';
import { EscrowEngine } from '../modules/escrow/escrow.engine';
import { redis } from '../config/redis';
import logger from '../core/logger';

/**
 * KAAGAZSEVA - Escrow Auto Release Scheduler
 *
 * Runs every 5 minutes
 * Protected with Redis distributed lock
 */

export const startEscrowCron = () => {

  cron.schedule(
    '*/5 * * * *',
    async () => {

      const lockKey = 'escrow_cron_lock';

      // prevent multi-instance execution
      const lock = await redis.set(lockKey, 'locked', 'EX', 240, 'NX');

      if (!lock) {
        logger.warn('Escrow cron already running on another instance');
        return;
      }

      logger.info('⏰ Escrow Cron Triggered');

      try {

        await EscrowEngine.processAutoRelease();

      } catch (error) {

        logger.error('Escrow Cron Failed', error);

      } finally {

        await redis.del(lockKey);

      }

    },
    {
      timezone: 'Asia/Kolkata',
    }
  );

  logger.info('🚀 Escrow Cron Scheduled (Every 5 minutes)');
};