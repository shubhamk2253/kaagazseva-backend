import { prisma } from '../../config/database';
import { AppError } from '../../core/AppError';
import {
  TransactionStatus,
  TransactionType,
  ApplicationStatus,
  UserRole,
} from '@prisma/client';
import logger from '../../core/logger';

/**
 * KAAGAZSEVA - Refund Engine (Full + Partial + Escrow Safe)
 */
export class RefundEngine {

  //////////////////////////////////////////////////////
  // 1️⃣ CUSTOMER REQUEST REFUND
  //////////////////////////////////////////////////////

  static async requestRefund(applicationId: string, userId: string) {

    const application = await prisma.application.findUnique({
      where: { id: applicationId },
    });

    if (!application) {
      throw new AppError('Application not found', 404);
    }

    if (application.customerId !== userId) {
      throw new AppError('Unauthorized refund request', 403);
    }

    if (application.paymentStatus !== TransactionStatus.SUCCESS) {
      throw new AppError('Cannot refund unpaid application', 400);
    }

    if (application.refundRequested) {
      throw new AppError('Refund already requested', 400);
    }

    await prisma.application.update({
      where: { id: applicationId },
      data: { refundRequested: true },
    });

    logger.info(`Refund requested for ${applicationId}`);

    return { message: 'Refund request submitted for review' };
  }

  //////////////////////////////////////////////////////
  // 2️⃣ ADMIN EXECUTE REFUND (FULL OR PARTIAL)
  //////////////////////////////////////////////////////

  static async executeRefund(
    applicationId: string,
    adminRole: UserRole,
    refundAmount?: number
  ) {

    if (adminRole !== UserRole.ADMIN) {
      throw new AppError('Only admin can process refunds', 403);
    }

    return prisma.$transaction(async (tx) => {

      const application = await tx.application.findUnique({
        where: { id: applicationId },
        include: { escrow: true },
      });

      if (!application || !application.escrow) {
        throw new AppError('Escrow not found', 404);
      }

      if (application.escrow.isReleased) {
        throw new AppError(
          'Escrow already released. Refund impossible.',
          400
        );
      }

      if (!application.refundRequested) {
        throw new AppError(
          'Refund not requested by customer',
          400
        );
      }

      const totalEscrow = Number(application.escrow.totalAmount);

      const finalRefundAmount =
        refundAmount ?? totalEscrow;

      if (finalRefundAmount <= 0) {
        throw new AppError('Invalid refund amount', 400);
      }

      if (finalRefundAmount > totalEscrow) {
        throw new AppError(
          'Refund exceeds escrow amount',
          400
        );
      }

      //////////////////////////////////////////////////////
      // 1️⃣ CREATE REFUND TRANSACTION
      //////////////////////////////////////////////////////

      await tx.transaction.create({
        data: {
          userId: application.customerId,
          amount: finalRefundAmount,
          type: TransactionType.REFUND,
          status: TransactionStatus.SUCCESS,
          referenceId: applicationId,
        },
      });

      //////////////////////////////////////////////////////
      // 2️⃣ HANDLE PARTIAL VS FULL
      //////////////////////////////////////////////////////

      if (finalRefundAmount === totalEscrow) {

        // FULL REFUND

        await tx.escrowHolding.update({
          where: { id: application.escrow.id },
          data: {
            isReleased: true,
            releasedAt: new Date(),
          },
        });

        await tx.application.update({
          where: { id: applicationId },
          data: {
            status: ApplicationStatus.CANCELLED,
            paymentStatus: TransactionStatus.REFUNDED,
            refundRequested: false,
          },
        });

      } else {

        // PARTIAL REFUND

        const remainingEscrow =
          totalEscrow - finalRefundAmount;

        await tx.escrowHolding.update({
          where: { id: application.escrow.id },
          data: {
            totalAmount: remainingEscrow,
          },
        });

        await tx.application.update({
          where: { id: applicationId },
          data: {
            refundRequested: false,
          },
        });
      }

      //////////////////////////////////////////////////////
      // 3️⃣ ADJUST AGENT METRICS (if not completed)
      //////////////////////////////////////////////////////

      if (
        application.status !== ApplicationStatus.COMPLETED &&
        application.agentId
      ) {
        await tx.agentMetrics.update({
          where: { agentId: application.agentId },
          data: {
            activeCases: { decrement: 1 },
          },
        });
      }

      logger.info(
        `Refund processed for ${applicationId} | Amount=${finalRefundAmount}`
      );

      return {
        refundedAmount: finalRefundAmount,
      };

    });
  }

  //////////////////////////////////////////////////////
  // 3️⃣ ADMIN REJECT REFUND
  //////////////////////////////////////////////////////

  static async rejectRefund(
    applicationId: string,
    adminRole: UserRole
  ) {

    if (adminRole !== UserRole.ADMIN) {
      throw new AppError('Only admin can reject refund', 403);
    }

    const application = await prisma.application.findUnique({
      where: { id: applicationId },
    });

    if (!application) {
      throw new AppError('Application not found', 404);
    }

    if (!application.refundRequested) {
      throw new AppError('No refund requested', 400);
    }

    await prisma.application.update({
      where: { id: applicationId },
      data: { refundRequested: false },
    });

    logger.info(`Refund rejected for ${applicationId}`);

    return { message: 'Refund request rejected' };
  }
}