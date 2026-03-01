import cron from 'node-cron';
import { prisma } from '../../config/database';
import { ApplicationStatus } from '@prisma/client';
import logger from '../../core/logger';
import { EscrowEngine } from './escrow.engine';

/**
 * KAAGAZSEVA - Escrow Auto Release Scheduler
 * Runs every 10 minutes
 */
export class EscrowAutoReleaseScheduler {

  static start() {

    logger.info('💰 Escrow Auto-Release Scheduler Started');

    cron.schedule('*/10 * * * *', async () => {

      try {

        //////////////////////////////////////////////////////
        // 1️⃣ Find eligible applications
        //////////////////////////////////////////////////////

        const eligibleApplications = await prisma.application.findMany({
          where: {
            status: ApplicationStatus.COMPLETED,
            refundRequested: false,
            autoReleaseAt: {
              lte: new Date(),
            },
            escrow: {
              isReleased: false,
            },
          },
          select: {
            id: true,
          },
        });

        if (!eligibleApplications.length) {
          return;
        }

        logger.info(
          `🔓 Releasing ${eligibleApplications.length} escrows`
        );

        //////////////////////////////////////////////////////
        // 2️⃣ Release using EscrowEngine (safe + atomic)
        //////////////////////////////////////////////////////

        for (const app of eligibleApplications) {

          try {
            await EscrowEngine.release(app.id);
          } catch (error) {
            logger.error(
              `Escrow release failed for ${app.id}`,
              error
            );
          }

        }

      } catch (error) {
        logger.error(
          'Escrow Auto Release Scheduler Error',
          error
        );
      }

    });

  }
}