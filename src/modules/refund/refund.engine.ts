import { prisma } from '../../config/database';
import { AppError } from '../../core/AppError';
import {
  TransactionStatus,
  TransactionType,
  ApplicationStatus,
  UserRole,
  AuditAction,
} from '@prisma/client';
import logger from '../../core/logger';
import { AnomalyEngine } from '../security/anomaly.engine';

/**
 * KAAGAZSEVA - Refund Engine
 * Handles financial refund execution
 */

export class RefundEngine {

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

  static async requestRefund(applicationId: string, userId: string) {

    const systemControl = await this.getSystemControl();

    if (systemControl.refundsFrozen) {
      throw new AppError(
        'Refunds are temporarily disabled due to system maintenance.',
        503
      );
    }

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

    await prisma.auditLog.create({
      data: {
        userId,
        action: AuditAction.CREATE,
        resourceType: 'REFUND_REQUEST',
        resourceId: applicationId,
        success: true,
      },
    });

    logger.warn(`Refund requested → ${applicationId}`);

    return { message: 'Refund request submitted for review' };
  }

  //////////////////////////////////////////////////////
  // EXECUTE REFUND
  //////////////////////////////////////////////////////

  static async executeRefund(
    applicationId: string,
    adminRole: UserRole,
    refundAmount?: number
  ) {

    const systemControl = await this.getSystemControl();

    if (systemControl.refundsFrozen) {
      throw new AppError(
        'Refund processing is temporarily disabled.',
        503
      );
    }

    if (adminRole !== UserRole.STATE_ADMIN && adminRole !== UserRole.FOUNDER) {
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
        throw new AppError('Refund exceeds escrow amount', 400);
      }

      //////////////////////////////////////////////////////
      // CREATE REFUND TRANSACTION
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
      // FRAUD DETECTION
      //////////////////////////////////////////////////////

      await AnomalyEngine.analyzeRefund(application.customerId);

      //////////////////////////////////////////////////////
      // HANDLE FULL VS PARTIAL
      //////////////////////////////////////////////////////

      if (finalRefundAmount === totalEscrow) {

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
      // AGENT METRICS FIX
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

      //////////////////////////////////////////////////////
      // AUDIT LOG
      //////////////////////////////////////////////////////

      await tx.auditLog.create({
        data: {
          userId: application.customerId,
          action: AuditAction.UPDATE,
          resourceType: 'REFUND_EXECUTED',
          resourceId: applicationId,
          success: true,
        },
      });

      logger.warn(
        `Refund processed → ${applicationId} | Amount=${finalRefundAmount}`
      );

      return {
        refundedAmount: finalRefundAmount,
      };

    });
  }

  //////////////////////////////////////////////////////
  // REJECT REFUND
  //////////////////////////////////////////////////////

  static async rejectRefund(
    applicationId: string,
    adminRole: UserRole
  ) {

    if (adminRole !== UserRole.STATE_ADMIN && adminRole !== UserRole.FOUNDER) {
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

    logger.info(`Refund rejected → ${applicationId}`);

    return { message: 'Refund request rejected' };
  }
}