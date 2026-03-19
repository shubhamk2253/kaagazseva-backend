import cron           from 'node-cron';
import { EscrowEngine } from '../modules/escrow/escrow.engine';
import { redis }      from '../config/redis';
import logger         from '../core/logger';

/**
 * KAAGAZSEVA - Escrow Auto Release Scheduler
 * Runs every 5 minutes (IST)
 * Delegates to EscrowEngine.processAutoRelease()
 * Protected with Redis distributed lock
 */

const LOCK_KEY     = 'lock:escrow-cron';
const LOCK_TTL_SEC = 270; // 4.5 min (cron runs every 5)

export const startEscrowCron = (): cron.ScheduledTask => {

  logger.info({ event: 'ESCROW_CRON_SCHEDULED' });

  const task = cron.schedule(
    '*/5 * * * *',
    async () => {

      // Distributed lock — prevents duplicate execution
      const lock = await redis.set(
        LOCK_KEY, '1', 'EX', LOCK_TTL_SEC, 'NX'
      );

      if (!lock) {
        logger.debug({ event: 'ESCROW_CRON_SKIPPED', reason: 'lock_active' });
        return;
      }

      logger.info({ event: 'ESCROW_CRON_TRIGGERED' });

      try {
        await EscrowEngine.processAutoRelease();
        logger.info({ event: 'ESCROW_CRON_COMPLETE' });

        // Only release lock on success
        await redis.del(LOCK_KEY);

      } catch (error: any) {
        logger.error({
          event:  'ESCROW_CRON_FAILED',
          error:  error.message,
        });
        // Lock expires naturally — prevents retry of failed run
      }

    },
    {
      timezone: 'Asia/Kolkata',
    }
  );

  return task;
};