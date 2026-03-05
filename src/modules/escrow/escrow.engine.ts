import { prisma } from '../../config/database';
import {
  ApplicationStatus,
  TransactionStatus,
  TransactionType,
  AuditAction,
} from '@prisma/client';
import logger from '../../core/logger';

/**
 * KAAGAZSEVA - Escrow Auto Release Engine
 *
 * Rule:
 * COMPLETED → 24hr hold → Auto Release
 * If refund exists → DO NOT release
 * If wallet frozen → DO NOT release
 */

export class EscrowEngine {

  //////////////////////////////////////////////////////
  // AUTO RELEASE PROCESS
  //////////////////////////////////////////////////////

  static async processAutoRelease() {

    logger.info('🔄 Escrow Auto-Release Engine Started');

    //////////////////////////////////////////////////////
    // 1️⃣ Find Completed Applications
    //////////////////////////////////////////////////////

    const applications = await prisma.application.findMany({
      where: {
        status: ApplicationStatus.COMPLETED,
        completedAt: {
          not: null,
        },
        escrow: {
          is: {
            isReleased: false,
          },
        },
      },
      include: {
        escrow: true,
        refundRequests: true,
      },
    });

    if (!applications.length) {
      logger.info('✅ No escrows pending release');
      return;
    }

    const now = Date.now();

    //////////////////////////////////////////////////////
    // 2️⃣ Process Each Application
    //////////////////////////////////////////////////////

    for (const application of applications) {

      try {

        if (!application.completedAt) continue;

        const completedTime = new Date(application.completedAt).getTime();

        const holdPeriod = 24 * 60 * 60 * 1000;

        if (now - completedTime < holdPeriod) {
          continue;
        }

        if (application.refundRequests.length > 0) {
          logger.warn(
            `🚫 Escrow blocked due to refund request → ${application.id}`
          );
          continue;
        }

        await prisma.$transaction(async (tx) => {

          const escrow = await tx.escrowHolding.findUnique({
            where: { applicationId: application.id },
          });

          if (!escrow) return;
          if (escrow.isReleased) return;

          if (!escrow.agentId) {
            logger.warn(
              `Escrow ${escrow.id} has no agent assigned`
            );
            return;
          }

          //////////////////////////////////////////////////////
          // Fetch Agent Wallet
          //////////////////////////////////////////////////////

          const wallet = await tx.wallet.findUnique({
            where: { userId: escrow.agentId },
          });

          if (!wallet) {
            logger.error(
              `Wallet missing for agent ${escrow.agentId}`
            );
            return;
          }

          if (wallet.isFrozen) {

            logger.warn(
              `🚫 Escrow blocked → frozen wallet → agent ${escrow.agentId}`
            );

            await tx.auditLog.create({
              data: {
                userId: escrow.agentId,
                action: AuditAction.UPDATE,
                resourceType: 'ESCROW_BLOCKED_FROZEN_WALLET',
                resourceId: application.id,
              },
            });

            return;
          }

          //////////////////////////////////////////////////////
          // Credit Wallet
          //////////////////////////////////////////////////////

          await tx.wallet.update({
            where: { userId: escrow.agentId },
            data: {
              balance: {
                increment: escrow.agentAmount,
              },
            },
          });

          //////////////////////////////////////////////////////
          // Mark Escrow Released
          //////////////////////////////////////////////////////

          await tx.escrowHolding.update({
            where: {
              id: escrow.id,
              isReleased: false,
            },
            data: {
              isReleased: true,
              releasedAt: new Date(),
            },
          });

          //////////////////////////////////////////////////////
          // Ledger Entry
          //////////////////////////////////////////////////////

          await tx.transaction.create({
            data: {
              userId: escrow.agentId,
              amount: escrow.agentAmount,
              type: TransactionType.ESCROW_RELEASE,
              status: TransactionStatus.SUCCESS,
              referenceId: application.id,
            },
          });

        });

        logger.info(
          `✅ Escrow released → Application ${application.id}`
        );

      } catch (error) {

        logger.error(
          `❌ Escrow release failed → Application ${application.id}`,
          error
        );
      }
    }

    logger.info('🏁 Escrow Auto-Release Engine Finished');
  }
}