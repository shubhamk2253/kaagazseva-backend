import { WalletRepository } from './wallet.repository';
import { AppError } from '../../core/AppError';
import { UserRole, TransactionStatus, TransactionType } from '@prisma/client';
import { prisma } from '../../config/database';
import logger from '../../core/logger';

/**
 * KAAGAZSEVA - Wallet Service
 * Approval-based withdrawal architecture
 */
export class WalletService {

  /* =====================================================
     Get Wallet Balance
  ===================================================== */
  static async getBalance(userId: string) {
    const wallet = await WalletRepository.findByUserId(userId);

    const LOW_BALANCE_THRESHOLD = 5000;
    const balance = Number(wallet.balance);

    return {
      balance,
      balanceInRupees: balance / 100,
      isLowBalance: balance < LOW_BALANCE_THRESHOLD,
      lastUpdated: wallet.updatedAt,
    };
  }

  /* =====================================================
     Top-Up Wallet
  ===================================================== */
  static async topUp(
    userId: string,
    amountInPaise: number,
    paymentMethod: string,
    externalReference?: string
  ) {
    if (!amountInPaise || amountInPaise <= 0) {
      throw new AppError('Invalid top-up amount', 400);
    }

    const result = await WalletRepository.createCredit(
      userId,
      amountInPaise,
      `Wallet top-up via ${paymentMethod}`,
      externalReference
    );

    return {
      walletBalance: Number(result.wallet.balance),
      walletBalanceInRupees: Number(result.wallet.balance) / 100,
      transactionId: result.transaction.id,
    };
  }

  /* =====================================================
     Pay For Service
  ===================================================== */
  static async payForService(
    userId: string,
    amountInPaise: number,
    serviceType: string,
    applicationId: string
  ) {
    if (!amountInPaise || amountInPaise <= 0) {
      throw new AppError('Invalid payment amount', 400);
    }

    const result = await WalletRepository.createDebit(
      userId,
      amountInPaise,
      `Payment for ${serviceType} application`,
      applicationId
    );

    return {
      walletBalance: Number(result.wallet.balance),
      walletBalanceInRupees: Number(result.wallet.balance) / 100,
      transactionId: result.transaction.id,
    };
  }

  /* =====================================================
     Create Withdrawal Request (Agent)
  ===================================================== */
  static async withdraw(
    userId: string,
    amountInPaise: number
  ) {

    if (!amountInPaise || amountInPaise <= 0) {
      throw new AppError('Invalid withdrawal amount', 400);
    }

    const wallet = await WalletRepository.findByUserId(userId);

    if (wallet.isFrozen) {
      throw new AppError('Wallet is frozen.', 403);
    }

    if (wallet.user.role !== UserRole.AGENT) {
      throw new AppError('Only agents can withdraw earnings', 403);
    }

    if (Number(wallet.balance) < amountInPaise) {
      throw new AppError('Insufficient wallet balance', 400);
    }

    const request = await prisma.withdrawalRequest.create({
      data: {
        agentId: userId,
        walletId: wallet.id,
        amount: amountInPaise,
        status: 'PENDING',
      },
    });

    logger.warn(`Withdrawal request created → ${request.id}`);

    return {
      requestId: request.id,
      amountInPaise,
      amountInRupees: amountInPaise / 100,
      status: 'PENDING_APPROVAL',
    };
  }

  /* =====================================================
     ADMIN - Approve Withdrawal
  ===================================================== */
  static async approveWithdrawal(
    requestId: string,
    adminId: string
  ) {

    const request = await prisma.withdrawalRequest.findUnique({
      where: { id: requestId },
      include: { wallet: true },
    });

    if (!request) {
      throw new AppError('Withdrawal request not found', 404);
    }

    if (request.status !== 'PENDING') {
      throw new AppError('Request already processed', 400);
    }

    await prisma.$transaction(async (tx) => {

      // 🔒 Re-fetch wallet inside transaction
      const wallet = await tx.wallet.findUnique({
        where: { id: request.walletId },
      });

      if (!wallet) throw new AppError('Wallet not found', 404);

      if (wallet.isFrozen) {
        throw new AppError('Wallet frozen. Cannot approve.', 403);
      }

      if (Number(wallet.balance) < request.amount) {
        throw new AppError('Insufficient balance at approval time', 400);
      }

      // 1️⃣ Debit wallet
      await tx.wallet.update({
        where: { id: wallet.id },
        data: {
          balance: { decrement: request.amount },
        },
      });

      // 2️⃣ Ledger entry
      await tx.transaction.create({
        data: {
          userId: request.agentId,
          amount: request.amount,
          type: TransactionType.DEBIT,
          status: TransactionStatus.SUCCESS,
          referenceId: request.id,
        },
      });

      // 3️⃣ Mark request approved
      await tx.withdrawalRequest.update({
        where: { id: request.id },
        data: {
          status: 'APPROVED',
          approvedBy: adminId,
          approvedAt: new Date(),
        },
      });

      // 4️⃣ Audit log
      await tx.auditLog.create({
        data: {
          userId: adminId,
          action: 'UPDATE',
          resourceType: 'WITHDRAWAL_APPROVED',
          resourceId: request.id,
          success: true,
        },
      });

    });

    logger.info(`Withdrawal approved → ${requestId}`);

    return { status: 'APPROVED' };
  }

  /* =====================================================
     ADMIN - Reject Withdrawal
  ===================================================== */
  static async rejectWithdrawal(
    requestId: string,
    reason: string,
    adminId: string
  ) {

    if (!reason || reason.length < 3) {
      throw new AppError('Rejection reason required', 400);
    }

    const request = await prisma.withdrawalRequest.findUnique({
      where: { id: requestId },
    });

    if (!request) {
      throw new AppError('Withdrawal request not found', 404);
    }

    if (request.status !== 'PENDING') {
      throw new AppError('Request already processed', 400);
    }

    await prisma.withdrawalRequest.update({
      where: { id: requestId },
      data: {
        status: 'REJECTED',
        rejectedBy: adminId,
        rejectedAt: new Date(),
        rejectionReason: reason,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: adminId,
        action: 'UPDATE',
        resourceType: 'WITHDRAWAL_REJECTED',
        resourceId: requestId,
        success: true,
      },
    });

    logger.warn(`Withdrawal rejected → ${requestId}`);

    return { status: 'REJECTED' };
  }

  /* =====================================================
     Transaction History
  ===================================================== */
  static async getHistory(
    userId: string,
    page: number = 1,
    limit: number = 10
  ) {
    const wallet = await WalletRepository.findByUserId(userId);

    const skip = (page - 1) * limit;

    const history = await WalletRepository.getTransactionHistory(
      userId,
      skip,
      limit
    );

    return {
      transactions: history.transactions.map((t) => ({
        ...t,
        amount: Number(t.amount),
        amountInRupees: Number(t.amount) / 100,
      })),
      total: history.total,
      currentPage: page,
      totalPages: history.totalPages,
    };
  }
}