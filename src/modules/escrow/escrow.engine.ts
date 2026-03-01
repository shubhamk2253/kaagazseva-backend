import { prisma } from '../../config/database';
import { AppError } from '../../core/AppError';
import {
  TransactionStatus,
  TransactionType,
  ApplicationStatus,
} from '@prisma/client';
import logger from '../../core/logger';

/**
 * KAAGAZSEVA - Escrow Engine
 * Handles manual & scheduled escrow release
 */
export class EscrowEngine {

  //////////////////////////////////////////////////////
  // RELEASE ESCROW
  //////////////////////////////////////////////////////

  static async release(applicationId: string) {

    return prisma.$transaction(async (tx) => {

      //////////////////////////////////////////////////////
      // 1️⃣ Fetch Application + Escrow
      //////////////////////////////////////////////////////

      const application = await tx.application.findUnique({
        where: { id: applicationId },
        include: { escrow: true },
      });

      if (!application || !application.escrow) {
        throw new AppError('Escrow not found', 404);
      }

      const escrow = application.escrow;

      if (escrow.isReleased) {
        throw new AppError(
          'Escrow already released',
          400
        );
      }

      if (application.refundRequested) {
        throw new AppError(
          'Escrow frozen due to refund request',
          400
        );
      }

      if (
        application.status !== ApplicationStatus.COMPLETED
      ) {
        throw new AppError(
          'Application not completed',
          400
        );
      }

      if (
        application.paymentStatus !==
        TransactionStatus.SUCCESS
      ) {
        throw new AppError(
          'Payment not successful',
          400
        );
      }

      if (!application.agentId) {
        throw new AppError(
          'No agent assigned',
          400
        );
      }

      //////////////////////////////////////////////////////
      // 2️⃣ Ensure Wallet Exists
      //////////////////////////////////////////////////////

      const wallet = await tx.wallet.findUnique({
        where: { userId: application.agentId },
      });

      if (!wallet) {
        await tx.wallet.create({
          data: {
            userId: application.agentId,
            balance: 0,
          },
        });
      }

      const agentAmount = Number(escrow.agentAmount);

      //////////////////////////////////////////////////////
      // 3️⃣ Credit Agent Wallet
      //////////////////////////////////////////////////////

      await tx.wallet.update({
        where: { userId: application.agentId },
        data: {
          balance: {
            increment: agentAmount,
          },
        },
      });

      //////////////////////////////////////////////////////
      // 4️⃣ Mark Escrow Released
      //////////////////////////////////////////////////////

      await tx.escrowHolding.update({
        where: { id: escrow.id },
        data: {
          isReleased: true,
          releasedAt: new Date(),
        },
      });

      //////////////////////////////////////////////////////
      // 5️⃣ Create ESCROW_RELEASE Transaction
      //////////////////////////////////////////////////////

      await tx.transaction.create({
        data: {
          userId: application.agentId,
          amount: agentAmount,
          type: TransactionType.ESCROW_RELEASE,
          status: TransactionStatus.SUCCESS,
          referenceId: applicationId,
        },
      });

      //////////////////////////////////////////////////////
      // 6️⃣ Update Agent Metrics
      //////////////////////////////////////////////////////

      await tx.agentMetrics.update({
        where: { agentId: application.agentId },
        data: {
          activeCases: { decrement: 1 },
          completedCases: { increment: 1 },
        },
      });

      logger.info(
        `Escrow released for application ${applicationId}`
      );

      return {
        message: 'Escrow released successfully',
        releasedAmount: agentAmount,
      };

    });
  }
}