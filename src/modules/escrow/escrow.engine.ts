import { prisma }  from '../../config/database';
import {
  ApplicationStatus,
  TransactionStatus,
  TransactionType,
  AuditAction,
}                  from '@prisma/client';
import { ESCROW }  from '../../core/constants';
import { QueueService } from '../../workers/queue.service';
import logger      from '../../core/logger';

/**
 * KAAGAZSEVA - Escrow Auto Release Engine
 *
 * Triggers on: CONFIRMED status OR 72hr after COMPLETED
 * Blocks on:   active refund request, frozen wallet
 */

export class EscrowEngine {

  static async processAutoRelease(): Promise<void> {

    const holdMs  = ESCROW.AUTO_RELEASE_HOURS * 60 * 60 * 1000;
    const cutoff  = new Date(Date.now() - holdMs);

    // Find CONFIRMED apps OR COMPLETED apps past hold period
    const applications = await prisma.application.findMany({
      where: {
        OR: [
          // Customer confirmed → release immediately
          { status: ApplicationStatus.CONFIRMED },
          // No response after hold period → auto release
          {
            status:      ApplicationStatus.COMPLETED,
            completedAt: { lt: cutoff },
          },
        ],
        escrow: {
          is: { isReleased: false },
        },
      },
      include: {
        escrow:         true,
        refundRequests: {
          where: { status: { notIn: ['REJECTED', 'PROCESSED'] } },
        },
      },
    });

    if (!applications.length) {
      logger.info({ event: 'ESCROW_NONE_PENDING' });
      return;
    }

    logger.info({
      event: 'ESCROW_PROCESSING',
      count: applications.length,
    });

    let released = 0;
    let skipped  = 0;

    for (const application of applications) {
      try {

        // Active refund request — block release
        if (application.refundRequests.length > 0) {
          logger.warn({
            event:         'ESCROW_BLOCKED_REFUND',
            applicationId: application.id,
          });
          skipped++;
          continue;
        }

        await prisma.$transaction(async (tx) => {

          const escrow = await tx.escrowHolding.findUnique({
            where: { applicationId: application.id },
          });

          if (!escrow || escrow.isReleased) return;

          if (!escrow.agentId) {
            logger.warn({
              event:   'ESCROW_NO_AGENT',
              escrowId: escrow.id,
            });
            return;
          }

          // Check agent wallet
          const wallet = await tx.wallet.findUnique({
            where: { userId: escrow.agentId },
          });

          if (!wallet) {
            logger.error({
              event:   'ESCROW_NO_WALLET',
              agentId: escrow.agentId,
            });
            return;
          }

          if (wallet.isFrozen) {
            logger.warn({
              event:         'ESCROW_BLOCKED_FROZEN_WALLET',
              agentId:       escrow.agentId,
              applicationId: application.id,
            });

            await tx.auditLog.create({
              data: {
                userId:       escrow.agentId,
                action:       AuditAction.PAYMENT,       // ✅
                resourceType: 'EscrowHolding',           // ✅
                resourceId:   escrow.id,
                newData:      { reason: 'wallet_frozen' },
                success:      false,
              },
            });
            return;
          }

          // 1. Credit agent wallet
          await tx.wallet.update({
            where: { userId: escrow.agentId },
            data:  { balance: { increment: escrow.agentAmount } },
          });

          // 2. Mark escrow released
          await tx.escrowHolding.update({
            where: { id: escrow.id, isReleased: false },
            data:  { isReleased: true, releasedAt: new Date() },
          });

          // 3. Ledger entry
          await tx.transaction.create({
            data: {
              userId:      escrow.agentId,
              walletId:    wallet.id,              // ✅ added
              amount:      escrow.agentAmount,
              type:        TransactionType.ESCROW_RELEASE,
              status:      TransactionStatus.SUCCESS,
              referenceId: application.id,
            },
          });

          // 4. Update agent metrics
          await tx.agentMetrics.update({
            where: { agentId: escrow.agentId },
            data: {
              totalEarnings:  { increment: escrow.agentAmount },
              pendingPayout:  { decrement: escrow.agentAmount },
              activeCases:    { decrement: 1 },
              completedCases: { increment: 1 },
            },
          });

          // 5. Close application
          await tx.application.update({
            where: { id: application.id },
            data: {
              status:   ApplicationStatus.CLOSED,  // ✅
              closedAt: new Date(),
            },
          });

          // 6. Audit log
          await tx.auditLog.create({
            data: {
              userId:       escrow.agentId,
              action:       AuditAction.PAYOUT,
              resourceType: 'EscrowHolding',
              resourceId:   escrow.id,
              newData: {
                agentAmount:   Number(escrow.agentAmount),
                applicationId: application.id,
                releasedAt:    new Date().toISOString(),
              },
              success: true,
            },
          });
        });

        // Notify agent of payment
        await QueueService.addNotificationJob({
          userId:  application.escrow!.agentId!,
          type:    'PUSH',
          title:   'Payment Released',
          message: `₹${Number(application.escrow!.agentAmount)} has been credited to your wallet`,
          data:    { type: 'PAYMENT_RELEASED', applicationId: application.id },
        });

        logger.info({
          event:         'ESCROW_RELEASED',
          applicationId: application.id,
          agentId:       application.escrow?.agentId,
          amount:        Number(application.escrow?.agentAmount),
        });

        released++;

      } catch (error: any) {
        logger.error({
          event:         'ESCROW_RELEASE_FAILED',
          applicationId: application.id,
          error:         error.message,
        });
        skipped++;
      }
    }

    logger.info({
      event:    'ESCROW_COMPLETE',
      released,
      skipped,
      total:    applications.length,
    });
  }
}