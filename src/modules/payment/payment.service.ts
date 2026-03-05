import { Prisma } from '@prisma/client';
import { prisma } from '../../config/database';
import { RazorpayProvider } from './razorpay.provider';
import { AppError } from '../../core/AppError';
import {
  TransactionStatus,
  TransactionType,
  ApplicationStatus,
} from '@prisma/client';
import logger from '../../core/logger';
import { AssignmentEngine } from '../../modules/assignment/assignment.engine';
import { AnomalyEngine } from '../security/anomaly.engine';
import { RiskEngine } from '../security/risk.engine';

/**
 * KAAGAZSEVA - FINANCIAL HARDENED PAYMENT SERVICE
 */

export class PaymentService {

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
  // CREATE PAYMENT ORDER
  //////////////////////////////////////////////////////

  static async createPaymentOrder(
    userId: string,
    applicationId: string
  ) {

    const systemControl = await this.getSystemControl();

    if (systemControl.paymentsFrozen) {
      throw new AppError(
        'Payments are temporarily disabled due to system maintenance.',
        503
      );
    }

    const application = await prisma.application.findUnique({
      where: { id: applicationId },
      include: { service: true },
    });

    if (!application) {
      throw new AppError('Application not found', 404);
    }

    if (application.customerId !== userId) {
      throw new AppError('Access denied', 403);
    }

    if (application.status !== ApplicationStatus.DRAFT) {
      throw new AppError(
        'Payment can only be initiated for DRAFT applications',
        400
      );
    }

    //////////////////////////////////////////////////////
    // Validate Mandatory Documents
    //////////////////////////////////////////////////////

    const requiredDocs = await prisma.serviceRequiredDocument.findMany({
      where: { serviceId: application.serviceId! },
    });

    const uploadedDocs = await prisma.applicationDocument.findMany({
      where: { applicationId },
    });

    const uploadedNames = uploadedDocs.map((d) => d.name);

    for (const doc of requiredDocs) {
      if (doc.isMandatory && !uploadedNames.includes(doc.documentName)) {
        throw new AppError(
          `Missing mandatory document: ${doc.documentName}`,
          400
        );
      }
    }

    const amount = Number(application.totalAmount);

    if (!amount || amount <= 0) {
      throw new AppError('Invalid payable amount', 400);
    }

    //////////////////////////////////////////////////////
    // Create Transaction
    //////////////////////////////////////////////////////

    const transaction = await prisma.transaction.create({
      data: {
        userId,
        amount,
        type: TransactionType.DEBIT,
        status: TransactionStatus.PENDING,
        metadata: {
          applicationId,
        } as Prisma.InputJsonValue,
      },
    });

    try {

      const razorpayOrder = await RazorpayProvider.createOrder(
        amount,
        transaction.id
      );

      await prisma.transaction.update({
        where: { id: transaction.id },
        data: { gatewayOrderId: razorpayOrder.id },
      });

      await prisma.application.update({
        where: { id: applicationId },
        data: { status: ApplicationStatus.PENDING_PAYMENT },
      });

      return {
        orderId: razorpayOrder.id,
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency,
        transactionId: transaction.id,
      };

    } catch (error) {

      await prisma.transaction.update({
        where: { id: transaction.id },
        data: { status: TransactionStatus.FAILED },
      });

      throw new AppError(
        'Payment initialization failed. Please try again.',
        500
      );
    }
  }

  //////////////////////////////////////////////////////
  // VERIFY PAYMENT
  //////////////////////////////////////////////////////

  static async verifyPayment(
    orderId: string,
    paymentId: string,
    signature: string,
    transactionId: string
  ) {

    const systemControl = await this.getSystemControl();

    if (systemControl.paymentsFrozen) {
      throw new AppError(
        'Payment verification temporarily disabled.',
        503
      );
    }

    const existingTransaction = await prisma.transaction.findUnique({
      where: { id: transactionId },
    });

    if (!existingTransaction) {
      throw new AppError('Transaction not found', 404);
    }

    if (existingTransaction.gatewayOrderId !== orderId) {
      throw new AppError('Invalid order reference', 400);
    }

    if (existingTransaction.status === TransactionStatus.SUCCESS) {
      return { message: 'Already processed' };
    }

    const isValid = RazorpayProvider.verifySignature(
      orderId,
      paymentId,
      signature
    );

    if (!isValid) {

      await prisma.transaction.update({
        where: { id: transactionId },
        data: { status: TransactionStatus.FAILED },
      });

      throw new AppError('Invalid payment signature', 400);
    }

    //////////////////////////////////////////////////////
    // ATOMIC TRANSACTION
    //////////////////////////////////////////////////////

    const result = await prisma.$transaction(async (tx) => {

      const updateResult = await tx.transaction.updateMany({
        where: {
          id: transactionId,
          status: TransactionStatus.PENDING,
        },
        data: {
          status: TransactionStatus.SUCCESS,
          gatewayPaymentId: paymentId,
        },
      });

      if (updateResult.count === 0) {
        throw new AppError(
          'Transaction already processed',
          400
        );
      }

      const originalTransaction = await tx.transaction.findUnique({
        where: { id: transactionId },
      });

      const metadata = originalTransaction?.metadata as {
        applicationId?: string;
      };

      const applicationId = metadata?.applicationId;

      if (!applicationId) {
        throw new AppError('Application reference missing', 400);
      }

      const application = await tx.application.findUnique({
        where: { id: applicationId },
      });

      if (!application) {
        throw new AppError('Application not found', 404);
      }

      //////////////////////////////////////////////////////
      // RISK ENGINE
      //////////////////////////////////////////////////////

      await RiskEngine.calculateRisk(
        application.customerId,
        applicationId,
        Number(application.totalAmount)
      );

      //////////////////////////////////////////////////////
      // UPDATE APPLICATION
      //////////////////////////////////////////////////////

      await tx.application.update({
        where: { id: applicationId },
        data: {
          paymentStatus: TransactionStatus.SUCCESS,
          paidAt: new Date(),
          status: ApplicationStatus.SUBMITTED,
        },
      });

      //////////////////////////////////////////////////////
      // CREATE ESCROW
      //////////////////////////////////////////////////////

      const agentAmount =
        Number(application.agentCommission) +
        Number(application.deliveryFee);

      const escrow = await tx.escrowHolding.create({
        data: {
          applicationId,
          customerId: application.customerId,
          agentId: application.agentId ?? null,
          totalAmount: Number(application.totalAmount),
          platformAmount: Number(application.platformCommission),
          agentAmount,
          isReleased: false,
        },
      });

      //////////////////////////////////////////////////////
      // ESCROW HOLD TRANSACTION
      //////////////////////////////////////////////////////

      await tx.transaction.create({
        data: {
          userId: application.customerId,
          amount: Number(application.totalAmount),
          type: TransactionType.ESCROW_HOLD,
          status: TransactionStatus.SUCCESS,
          referenceId: applicationId,
        },
      });

      return {
        applicationId,
        escrowId: escrow.id,
        userId: application.customerId,
        amount: Number(application.totalAmount),
      };
    });

    //////////////////////////////////////////////////////
    // POST TRANSACTION HOOKS
    //////////////////////////////////////////////////////

    try {
      await AssignmentEngine.autoAssign(result.applicationId);
    } catch (err) {
      logger.error({
        event: 'AUTO_ASSIGNMENT_FAILED',
        error: err,
      });
    }

    //////////////////////////////////////////////////////
    // FRAUD DETECTION
    //////////////////////////////////////////////////////

    try {
      await AnomalyEngine.analyzePayment(
        result.userId,
        result.amount
      );
    } catch (err) {
      logger.error({
        event: 'ANOMALY_ENGINE_FAILED',
        error: err,
      });
    }

    logger.info({
      event: 'PAYMENT_SUCCESS',
      transactionId,
      applicationId: result.applicationId,
    });

    return {
      message: 'Payment verified and escrow created successfully',
      escrowId: result.escrowId,
    };
  }
}