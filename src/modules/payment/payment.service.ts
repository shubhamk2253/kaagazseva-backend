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
 * Phase 5C – Idempotency + Risk Engine + Anomaly Detection + System Control
 */

export class PaymentService {

  //////////////////////////////////////////////////////
  // INTERNAL SYSTEM CONTROL HELPER
  //////////////////////////////////////////////////////

  private static async getSystemControl() {
    return prisma.systemControl.upsert({
      where: { id: 'SYSTEM_CONTROL_SINGLETON' },
      update: {},
      create: { id: 'SYSTEM_CONTROL_SINGLETON' },
    });
  }

  //////////////////////////////////////////////////////
  // 1️⃣ CREATE PAYMENT ORDER
  //////////////////////////////////////////////////////

  static async createPaymentOrder(
    userId: string,
    applicationId: string
  ) {

    if (!userId || !applicationId) {
      throw new AppError('Missing required parameters', 400);
    }

    //////////////////////////////////////////////////////
    // GLOBAL PAYMENT FREEZE CHECK
    //////////////////////////////////////////////////////

    const systemControl = await this.getSystemControl();

    if (systemControl.paymentsFrozen) {
      throw new AppError(
        'Payments are temporarily disabled due to system maintenance.',
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
      throw new AppError('Access denied', 403);
    }

    if (application.status !== ApplicationStatus.DRAFT) {
      throw new AppError(
        'Payment can only be initiated for DRAFT applications',
        400
      );
    }

    //////////////////////////////////////////////////////
    // Validate Service
    //////////////////////////////////////////////////////

    let service = null;

    if (application.serviceId) {
      service = await prisma.service.findUnique({
        where: { id: application.serviceId },
      });
    }

    if (!service) {
      service = await prisma.service.findFirst({
        where: { name: application.serviceType },
      });
    }

    if (!service) {
      throw new AppError('Service not found', 404);
    }

    //////////////////////////////////////////////////////
    // Validate Mandatory Documents
    //////////////////////////////////////////////////////

    const requiredDocs = await prisma.serviceRequiredDocument.findMany({
      where: { serviceId: service.id },
    });

    const uploadedDocs =
      (application.documents as Record<string, any>) || {};

    for (const doc of requiredDocs) {
      if (doc.isMandatory && !uploadedDocs[doc.documentName]) {
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
    // Create Transaction (Atomic Placeholder)
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
  // 2️⃣ VERIFY PAYMENT (STRICT IDEMPOTENT VERSION)
  //////////////////////////////////////////////////////

  static async verifyPayment(
    orderId: string,
    paymentId: string,
    signature: string,
    transactionId: string
  ) {

    //////////////////////////////////////////////////////
    // GLOBAL PAYMENT FREEZE CHECK
    //////////////////////////////////////////////////////

    const systemControl = await this.getSystemControl();

    if (systemControl.paymentsFrozen) {
      throw new AppError(
        'Payment verification temporarily disabled.',
        503
      );
    }

    if (!orderId || !paymentId || !signature || !transactionId) {
      throw new AppError('Missing payment verification parameters', 400);
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
    // 🔒 HARDENED ATOMIC TRANSACTION
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
          'Transaction already processed or invalid state',
          400
        );
      }

      const originalTransaction = await tx.transaction.findUnique({
        where: { id: transactionId },
      });

      const applicationId =
        (originalTransaction?.metadata as any)?.applicationId;

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

      if (application.paymentStatus === TransactionStatus.SUCCESS) {
        throw new AppError(
          'Payment already processed at application level',
          400
        );
      }

      const existingEscrow = await tx.escrowHolding.findUnique({
        where: { applicationId },
      });

      if (existingEscrow) {
        throw new AppError(
          'Escrow already exists for this application',
          400
        );
      }

      //////////////////////////////////////////////////////
      // Update Application
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
      // Create Escrow
      //////////////////////////////////////////////////////

      const agentAmount =
        Number(application.agentCommission) +
        Number(application.deliveryFee);

      const escrow = await tx.escrowHolding.create({
        data: {
          applicationId,
          customerId: application.customerId,
          agentId: application.agentId ?? null,
          totalAmount: application.totalAmount,
          platformAmount: application.platformCommission,
          agentAmount,
          isReleased: false,
        },
      });

      //////////////////////////////////////////////////////
      // Escrow Hold Transaction
      //////////////////////////////////////////////////////

      await tx.transaction.create({
        data: {
          userId: application.customerId,
          amount: application.totalAmount,
          type: TransactionType.ESCROW_HOLD,
          status: TransactionStatus.SUCCESS,
          referenceId: applicationId,
        },
      });

      return {
        applicationId,
        escrowId: escrow.id,
      };
    });

    //////////////////////////////////////////////////////
    // Post-Transaction Hooks
    //////////////////////////////////////////////////////

    try {
      await AssignmentEngine.autoAssign(result.applicationId);
    } catch (err) {
      logger.error('Auto-assignment failed', err);
    }

    logger.info(`Payment & Escrow SUCCESS → tx=${transactionId}`);

    //////////////////////////////////////////////////////
    // ANOMALY DETECTION
    //////////////////////////////////////////////////////

    await AnomalyEngine.analyzePayment(
      existingTransaction.userId,
      Number(existingTransaction.amount)
    );

    return {
      message: 'Payment verified and escrow created successfully',
      escrowId: result.escrowId,
    };
  }
}