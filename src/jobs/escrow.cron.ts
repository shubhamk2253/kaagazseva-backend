import cron from 'node-cron';
import { EscrowEngine } from '../modules/escrow/escrow.engine';
import logger from '../core/logger';

/**
 * Escrow Auto Release Cron Job
 * Runs every 5 minutes
 */
export const startEscrowCron = () => {

  // Every 5 minutes
  cron.schedule('*/5 * * * *', async () => {

    logger.info('⏰ Escrow Cron Triggered');

    try {
      await EscrowEngine.processAutoRelease();
    } catch (error) {
      logger.error('Escrow Cron Failed', error);
    }

  });

  logger.info('🚀 Escrow Cron Scheduled (Every 5 minutes)');
};