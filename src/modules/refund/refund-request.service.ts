import { prisma } from '../../config/database';
import { AppError } from '../../core/AppError';
import { RefundStatus, TransactionStatus, UserRole } from '@prisma/client';
import logger from '../../core/logger';

export class RefundRequestService {

  //////////////////////////////////////////////////////
  // 1️⃣ CUSTOMER REQUEST REFUND
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

    logger.info(`Refund REQUESTED → App=${applicationId}`);

    return refund;
  }

  //////////////////////////////////////////////////////
  // 2️⃣ STATE ADMIN REVIEW
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
      throw new AppError('Only State Admin or Founder can review refund', 403);
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

    logger.info(
      `Refund ${decision} → RefundId=${refundId}`
    );

    return updated;
  }

  //////////////////////////////////////////////////////
  // 3️⃣ PROCESS APPROVED REFUND (FINANCIAL CORE)
  //////////////////////////////////////////////////////

  static async processApprovedRefund(
    refundId: string,
    processorId: string
  ) {

    return prisma.$transaction(async (tx) => {

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

      if (refund.status !== 'APPROVED') {
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

      //////////////////////////////////////////////////////
      // PLATFORM FIRST DEDUCTION
      //////////////////////////////////////////////////////

      let remainingRefund = refundAmount;

      let platformAmount = Number(escrow.platformAmount);
      let agentAmount = Number(escrow.agentAmount);

      let platformDeducted = 0;
      let agentDeducted = 0;

      // 1️⃣ Deduct from platform
      if (platformAmount > 0) {
        const deduct = Math.min(platformAmount, remainingRefund);
        platformDeducted = deduct;
        platformAmount -= deduct;
        remainingRefund -= deduct;
      }

      // 2️⃣ Deduct remaining from agent
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
        },
      });

      //////////////////////////////////////////////////////
      // CREATE REFUND TRANSACTION
      //////////////////////////////////////////////////////

      await tx.transaction.create({
        data: {
          userId: application.customerId,
          amount: refundAmount,
          type: 'REFUND',
          status: 'SUCCESS',
          referenceId: application.id,
        },
      });

      //////////////////////////////////////////////////////
      // COMMISSION ROLLBACK TRANSACTIONS
      //////////////////////////////////////////////////////

      if (platformDeducted > 0) {
        await tx.transaction.create({
          data: {
            userId: application.customerId,
            amount: platformDeducted,
            type: 'DEBIT',
            status: 'SUCCESS',
            referenceId: `PLATFORM_ROLLBACK_${application.id}`,
          },
        });
      }

      if (agentDeducted > 0 && application.agentId) {
        await tx.transaction.create({
          data: {
            userId: application.agentId,
            amount: agentDeducted,
            type: 'DEBIT',
            status: 'SUCCESS',
            referenceId: `AGENT_ROLLBACK_${application.id}`,
          },
        });
      }

      //////////////////////////////////////////////////////
      // FULL REFUND → CANCEL APPLICATION
      //////////////////////////////////////////////////////

      if (refundAmount === totalEscrow) {
        await tx.application.update({
          where: { id: application.id },
          data: {
            paymentStatus: 'REFUNDED',
            status: 'CANCELLED',
          },
        });
      }

      //////////////////////////////////////////////////////
      // MARK REFUND PROCESSED
      //////////////////////////////////////////////////////

      await tx.refundRequest.update({
        where: { id: refundId },
        data: {
          status: 'PROCESSED',
          processedAt: new Date(),
        },
      });

      //////////////////////////////////////////////////////
      // AUDIT ENTRY
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

      logger.info(
        `Refund PROCESSED → ${refundId} | Amount=${refundAmount}`
      );

      return {
        refundedAmount: refundAmount,
        platformDeducted,
        agentDeducted,
      };

    });

  }

}