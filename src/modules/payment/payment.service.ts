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

/**
 * KAAGAZSEVA - Secure Application-Locked Payment Service
 * Flow:
 * DRAFT → PENDING_PAYMENT → SUBMITTED → Escrow → Assignment
 */
export class PaymentService {

  //////////////////////////////////////////////////////
  // 1️⃣ CREATE PAYMENT ORDER (LOCKED TO APPLICATION)
  //////////////////////////////////////////////////////

  static async createPaymentOrder(
    userId: string,
    applicationId: string
  ) {

    if (!userId || !applicationId) {
      throw new AppError('Missing required parameters', 400);
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

      //////////////////////////////////////////////////////
      // Move Application → PENDING_PAYMENT
      //////////////////////////////////////////////////////

      await prisma.application.update({
        where: { id: applicationId },
        data: {
          status: ApplicationStatus.PENDING_PAYMENT,
        },
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
  // 2️⃣ VERIFY PAYMENT (ESCROW FLOW)
  //////////////////////////////////////////////////////

  static async verifyPayment(
    orderId: string,
    paymentId: string,
    signature: string,
    transactionId: string
  ) {

    if (!orderId || !paymentId || !signature || !transactionId) {
      throw new AppError('Missing payment verification parameters', 400);
    }

    const existingTransaction = await prisma.transaction.findUnique({
      where: { id: transactionId },
    });

    if (!existingTransaction) {
      throw new AppError('Transaction not found', 404);
    }

    if (existingTransaction.status === TransactionStatus.SUCCESS) {
      return { message: 'Already processed' };
    }

    if (existingTransaction.gatewayOrderId !== orderId) {
      throw new AppError('Invalid order reference', 400);
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
    // 🔒 ATOMIC TRANSACTION
    //////////////////////////////////////////////////////

    const result = await prisma.$transaction(async (tx) => {

      // 1️⃣ Mark Transaction SUCCESS
      const transaction = await tx.transaction.update({
        where: { id: transactionId },
        data: {
          status: TransactionStatus.SUCCESS,
          gatewayPaymentId: paymentId,
        },
      });

      const applicationId =
        (transaction.metadata as any)?.applicationId;

      if (!applicationId) {
        throw new AppError('Application reference missing', 400);
      }

      const application = await tx.application.findUnique({
        where: { id: applicationId },
      });

      if (!application) {
        throw new AppError('Application not found', 404);
      }

      if (application.paymentStatus === TransactionStatus.SUCCESS) {
        throw new AppError('Payment already processed', 400);
      }

      // 2️⃣ Update Application → SUBMITTED
      await tx.application.update({
        where: { id: applicationId },
        data: {
          paymentStatus: TransactionStatus.SUCCESS,
          paidAt: new Date(),
          status: ApplicationStatus.SUBMITTED,
        },
      });

      // 3️⃣ Create Escrow
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

      // 4️⃣ Escrow Hold Transaction
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
    // 🚀 Auto Assignment
    //////////////////////////////////////////////////////

    try {
      await AssignmentEngine.autoAssign(result.applicationId);
    } catch (err) {
      logger.error('Auto-assignment failed', err);
    }

    logger.info(`Payment & Escrow SUCCESS → tx=${transactionId}`);

    return {
      message: 'Payment verified and escrow created successfully',
      escrowId: result.escrowId,
    };
  }
}