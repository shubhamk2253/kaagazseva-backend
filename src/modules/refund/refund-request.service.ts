import { prisma } from '../../config/database';
import { AppError } from '../../core/AppError';
import {
  RefundStatus,
  TransactionStatus,
  TransactionType,
  ApplicationStatus,
  UserRole,
} from '@prisma/client';
import logger from '../../core/logger';
import { AnomalyEngine } from '../security/anomaly.engine';

export class RefundRequestService {

  //////////////////////////////////////////////////////
  // SYSTEM CONTROL HELPER
  //////////////////////////////////////////////////////

  private static async getSystemControl() {
    return prisma.systemControl.upsert({
      where: { id: 'SYSTEM_CONTROL_SINGLETON' },
      update: {},
      create: { id: 'SYSTEM_CONTROL_SINGLETON' },
    });
  }

  //////////////////////////////////////////////////////
  // CUSTOMER REQUEST REFUND
  //////////////////////////////////////////////////////

  static async requestRefund(
    applicationId: string,
    userId: string,
    amount: number,
    reason: string
  ) {

    if (!reason || reason.length < 5) {
      throw new AppError('Valid refund reason required', 400);
    }

    if (!amount || amount <= 0) {
      throw new AppError('Invalid refund amount', 400);
    }

    const application = await prisma.application.findUnique({
      where: { id: applicationId },
      include: { escrow: true },
    });

    if (!application || !application.escrow) {
      throw new AppError('Application or escrow not found', 404);
    }

    if (application.customerId !== userId) {
      throw new AppError('Unauthorized refund request', 403);
    }

    if (application.paymentStatus !== TransactionStatus.SUCCESS) {
      throw new AppError('Cannot refund unpaid application', 400);
    }

    if (application.escrow.isReleased) {
      throw new AppError('Escrow already released', 400);
    }

    const totalEscrow = Number(application.escrow.totalAmount);

    if (amount > totalEscrow) {
      throw new AppError('Refund exceeds escrow amount', 400);
    }

    const existingRequest = await prisma.refundRequest.findFirst({
      where: {
        applicationId,
        status: {
          in: [
            RefundStatus.REQUESTED,
            RefundStatus.APPROVED,
          ],
        },
      },
    });

    if (existingRequest) {
      throw new AppError('Active refund request already exists', 400);
    }

    const refund = await prisma.refundRequest.create({
      data: {
        applicationId,
        requestedById: userId,
        amount,
        reason,
        status: RefundStatus.REQUESTED,
      },
    });

    logger.info({
      event: 'REFUND_REQUESTED',
      applicationId,
      amount,
    });

    return refund;
  }

  //////////////////////////////////////////////////////
  // ADMIN REVIEW REFUND
  //////////////////////////////////////////////////////

  static async reviewRefund(
    refundId: string,
    reviewerId: string,
    reviewerRole: UserRole,
    decision: 'APPROVE' | 'REJECT'
  ) {

    if (
      reviewerRole !== UserRole.STATE_ADMIN &&
      reviewerRole !== UserRole.FOUNDER
    ) {
      throw new AppError(
        'Only State Admin or Founder can review refund',
        403
      );
    }

    const refund = await prisma.refundRequest.findUnique({
      where: { id: refundId },
    });

    if (!refund) {
      throw new AppError('Refund request not found', 404);
    }

    if (refund.status !== RefundStatus.REQUESTED) {
      throw new AppError('Refund already reviewed', 400);
    }

    const updated = await prisma.refundRequest.update({
      where: { id: refundId },
      data: {
        status:
          decision === 'APPROVE'
            ? RefundStatus.APPROVED
            : RefundStatus.REJECTED,
        reviewedById: reviewerId,
      },
    });

    logger.info({
      event: 'REFUND_REVIEWED',
      refundId,
      decision,
    });

    return updated;
  }

  //////////////////////////////////////////////////////
  // PROCESS APPROVED REFUND
  //////////////////////////////////////////////////////

  static async processApprovedRefund(
    refundId: string,
    processorId: string
  ) {

    const systemControl = await this.getSystemControl();

    if (systemControl.refundsFrozen) {
      throw new AppError(
        'Refund processing temporarily disabled.',
        503
      );
    }

    const result = await prisma.$transaction(async (tx) => {

      const refund = await tx.refundRequest.findUnique({
        where: { id: refundId },
        include: {
          application: {
            include: { escrow: true },
          },
        },
      });

      if (!refund) {
        throw new AppError('Refund request not found', 404);
      }

      if (refund.status !== RefundStatus.APPROVED) {
        throw new AppError('Refund not approved', 400);
      }

      if (refund.processedAt) {
        throw new AppError('Refund already processed', 400);
      }

      const application = refund.application;
      const escrow = application.escrow;

      if (!escrow || escrow.isReleased) {
        throw new AppError('Escrow unavailable for refund', 400);
      }

      const refundAmount = Number(refund.amount);
      const totalEscrow = Number(escrow.totalAmount);

      if (refundAmount > totalEscrow) {
        throw new AppError('Refund exceeds escrow balance', 400);
      }

      let remainingRefund = refundAmount;

      let platformAmount = Number(escrow.platformAmount);
      let agentAmount = Number(escrow.agentAmount);

      let platformDeducted = 0;
      let agentDeducted = 0;

      //////////////////////////////////////////////////////
      // Deduct platform first
      //////////////////////////////////////////////////////

      if (platformAmount > 0) {
        const deduct = Math.min(platformAmount, remainingRefund);
        platformDeducted = deduct;
        platformAmount -= deduct;
        remainingRefund -= deduct;
      }

      //////////////////////////////////////////////////////
      // Deduct agent second
      //////////////////////////////////////////////////////

      if (remainingRefund > 0) {
        const deduct = Math.min(agentAmount, remainingRefund);
        agentDeducted = deduct;
        agentAmount -= deduct;
        remainingRefund -= deduct;
      }

      if (remainingRefund > 0) {
        throw new AppError('Refund calculation error', 500);
      }

      //////////////////////////////////////////////////////
      // UPDATE ESCROW
      //////////////////////////////////////////////////////

      await tx.escrowHolding.update({
        where: { id: escrow.id },
        data: {
          totalAmount: totalEscrow - refundAmount,
          platformAmount,
          agentAmount,
          ...(refundAmount === totalEscrow && {
            isReleased: true,
            releasedAt: new Date(),
          }),
        },
      });

      //////////////////////////////////////////////////////
      // CREATE REFUND TRANSACTION
      //////////////////////////////////////////////////////

      await tx.transaction.create({
        data: {
          userId: application.customerId,
          amount: refundAmount,
          type: TransactionType.REFUND,
          status: TransactionStatus.SUCCESS,
          referenceId: application.id,
        },
      });

      //////////////////////////////////////////////////////
      // ROLLBACK TRANSACTIONS
      //////////////////////////////////////////////////////

      if (platformDeducted > 0) {
        await tx.transaction.create({
          data: {
            userId: application.customerId,
            amount: platformDeducted,
            type: TransactionType.DEBIT,
            status: TransactionStatus.SUCCESS,
            referenceId: `PLATFORM_ROLLBACK_${application.id}`,
          },
        });
      }

      if (agentDeducted > 0 && application.agentId) {
        await tx.transaction.create({
          data: {
            userId: application.agentId,
            amount: agentDeducted,
            type: TransactionType.DEBIT,
            status: TransactionStatus.SUCCESS,
            referenceId: `AGENT_ROLLBACK_${application.id}`,
          },
        });
      }

      //////////////////////////////////////////////////////
      // FULL REFUND CANCELS APPLICATION
      //////////////////////////////////////////////////////

      if (refundAmount === totalEscrow) {
        await tx.application.update({
          where: { id: application.id },
          data: {
            paymentStatus: TransactionStatus.REFUNDED,
            status: ApplicationStatus.CANCELLED,
          },
        });
      }

      //////////////////////////////////////////////////////
      // MARK REFUND PROCESSED
      //////////////////////////////////////////////////////

      await tx.refundRequest.update({
        where: { id: refundId },
        data: {
          status: RefundStatus.PROCESSED,
          processedAt: new Date(),
        },
      });

      //////////////////////////////////////////////////////
      // AUDIT LOG
      //////////////////////////////////////////////////////

      await tx.auditLog.create({
        data: {
          userId: processorId,
          action: 'UPDATE',
          resourceType: 'REFUND_PROCESSED',
          resourceId: refundId,
          success: true,
        },
      });

      logger.info({
        event: 'REFUND_PROCESSED',
        refundId,
        amount: refundAmount,
      });

      return {
        refundedAmount: refundAmount,
        platformDeducted,
        agentDeducted,
        customerId: application.customerId,
      };
    });

    //////////////////////////////////////////////////////
    // FRAUD ANALYSIS (POST TRANSACTION)
    //////////////////////////////////////////////////////

    try {
      await AnomalyEngine.analyzeRefund(result.customerId);
    } catch (err) {
      logger.error({
        event: 'REFUND_ANOMALY_ENGINE_FAILED',
        error: err,
      });
    }

    return result;
  }

}