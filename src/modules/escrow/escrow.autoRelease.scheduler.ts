import cron from 'node-cron';
import logger from '../../core/logger';
import { EscrowEngine } from './escrow.engine';

/**
 * KAAGAZSEVA - Escrow Auto Release Scheduler
 * Runs every 5 minutes
 */
export class EscrowAutoReleaseScheduler {

  private static isRunning = false;

  static start() {

    logger.info('💰 Escrow Auto-Release Scheduler Started (Every 5 minutes)');

    cron.schedule('*/5 * * * *', async () => {

      if (this.isRunning) {
        logger.warn('Escrow scheduler already running. Skipping cycle.');
        return;
      }

      this.isRunning = true;

      try {
        await EscrowEngine.processAutoRelease();
      } catch (error) {
        logger.error('Escrow Auto Release Scheduler Error', error);
      } finally {
        this.isRunning = false;
      }

    });
  }
}