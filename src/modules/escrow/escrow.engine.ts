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
 * If refundRequested = true → DO NOT release
 * If wallet.isFrozen = true → DO NOT release
 */
export class EscrowEngine {

  //////////////////////////////////////////////////////
  // 1️⃣ PROCESS AUTO RELEASE
  //////////////////////////////////////////////////////

  static async processAutoRelease() {

    logger.info('🔄 Escrow Auto-Release Engine Started');

    //////////////////////////////////////////////////////
    // 1️⃣ Find Eligible Applications
    //////////////////////////////////////////////////////

    const eligibleApplications = await prisma.application.findMany({
      where: {
        status: ApplicationStatus.COMPLETED,
        autoReleaseAt: {
          lte: new Date(),
        },
        refundRequested: false,
        escrow: {
          is: {
            isReleased: false,
          },
        },
      },
      include: {
        escrow: true,
      },
    });

    if (!eligibleApplications.length) {
      logger.info('✅ No eligible escrows for release');
      return;
    }

    logger.info(
      `⚡ Found ${eligibleApplications.length} escrows to release`
    );

    //////////////////////////////////////////////////////
    // 2️⃣ Process Each Safely
    //////////////////////////////////////////////////////

    for (const application of eligibleApplications) {

      try {

        await prisma.$transaction(async (tx) => {

          const escrow = await tx.escrowHolding.findUnique({
            where: { applicationId: application.id },
          });

          if (!escrow) return;
          if (escrow.isReleased) return;

          //////////////////////////////////////////////////////
          // 🔒 Ensure Agent Exists
          //////////////////////////////////////////////////////

          if (!escrow.agentId) {
            logger.warn(
              `Escrow ${escrow.id} has no agent assigned`
            );
            return;
          }

          //////////////////////////////////////////////////////
          // 1️⃣ Fetch Wallet
          //////////////////////////////////////////////////////

          const agentWallet = await tx.wallet.findUnique({
            where: { userId: escrow.agentId },
          });

          if (!agentWallet) {
            logger.error(
              `Wallet missing for agent ${escrow.agentId}`
            );
            return;
          }

          //////////////////////////////////////////////////////
          // 🚫 BLOCK IF WALLET FROZEN
          //////////////////////////////////////////////////////

          if (agentWallet.isFrozen) {

            logger.warn(
              `🚫 Escrow blocked → Frozen wallet → Agent ${escrow.agentId}`
            );

            await tx.auditLog.create({
              data: {
                action: AuditAction.UPDATE,
                resourceType: 'ESCROW_BLOCKED_FROZEN_WALLET',
                resourceId: application.id,
                newData: {
                  agentId: escrow.agentId,
                  reason: 'Wallet frozen',
                },
                success: false,
              },
            });

            return; // 🚫 DO NOT RELEASE
          }

          //////////////////////////////////////////////////////
          // 2️⃣ CREDIT WALLET
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
          // 3️⃣ Mark Escrow Released
          //////////////////////////////////////////////////////

          await tx.escrowHolding.update({
            where: { id: escrow.id },
            data: {
              isReleased: true,
              releasedAt: new Date(),
            },
          });

          //////////////////////////////////////////////////////
          // 4️⃣ Create ESCROW_RELEASE Transaction
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
          `✅ Escrow released for Application ${application.id}`
        );

      } catch (error) {

        logger.error(
          `❌ Escrow release failed for Application ${application.id}`,
          error
        );
      }
    }

    logger.info('🏁 Escrow Auto-Release Engine Finished');
  }
}