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
  // GET WALLET BALANCE
  //////////////////////////////////////////////////////

  static async getBalance(userId: string) {

    const wallet = await WalletRepository.findByUserId(userId);

    const LOW_BALANCE_THRESHOLD = 50;

    const balance = Number(wallet.balance);

    return {
      balance,
      isLowBalance: balance < LOW_BALANCE_THRESHOLD,
      lastUpdated: wallet.updatedAt,
    };
  }

  //////////////////////////////////////////////////////
  // TOP-UP WALLET
  //////////////////////////////////////////////////////

  static async topUp(
    userId: string,
    amount: number,
    paymentMethod: string,
    externalReference?: string
  ) {

    if (!amount || amount <= 0) {
      throw new AppError('Invalid top-up amount', 400);
    }

    const result = await WalletRepository.createCredit(
      userId,
      amount,
      `Wallet top-up via ${paymentMethod}`,
      externalReference
    );

    return {
      walletBalance: Number(result.wallet.balance),
      transactionId: result.transaction.id,
    };
  }

  //////////////////////////////////////////////////////
  // PAY FOR SERVICE (Internal wallet usage)
  //////////////////////////////////////////////////////

  static async payForService(
    userId: string,
    amount: number,
    serviceType: string,
    applicationId: string
  ) {

    if (!amount || amount <= 0) {
      throw new AppError('Invalid payment amount', 400);
    }

    const result = await WalletRepository.createDebit(
      userId,
      amount,
      `Payment for ${serviceType} application`,
      applicationId
    );

    return {
      walletBalance: Number(result.wallet.balance),
      transactionId: result.transaction.id,
    };
  }

  //////////////////////////////////////////////////////
  // CREATE WITHDRAWAL REQUEST (AGENT)
  //////////////////////////////////////////////////////

  static async withdraw(
    userId: string,
    amount: number
  ) {

    const systemControl = await this.getSystemControl();

    if (systemControl.withdrawalsFrozen) {
      throw new AppError(
        'Withdrawals are temporarily disabled due to system maintenance.',
        503
      );
    }

    if (!amount || amount <= 0) {
      throw new AppError('Invalid withdrawal amount', 400);
    }

    const wallet = await WalletRepository.findByUserId(userId);

    if (wallet.isFrozen) {
      throw new AppError('Wallet is frozen.', 403);
    }

    if (wallet.user.role !== UserRole.AGENT) {
      throw new AppError('Only agents can withdraw earnings', 403);
    }

    if (Number(wallet.balance) < amount) {
      throw new AppError('Insufficient wallet balance', 400);
    }

    const request = await prisma.withdrawalRequest.create({
      data: {
        agentId: userId,
        walletId: wallet.id,
        amount,
        status: 'PENDING',
      },
    });

    logger.warn(`Withdrawal request created → ${request.id}`);

    return {
      requestId: request.id,
      amount,
      status: 'PENDING_APPROVAL',
    };
  }

  //////////////////////////////////////////////////////
  // APPROVE WITHDRAWAL (STATE_ADMIN)
  //////////////////////////////////////////////////////

  static async approveWithdrawal(
    requestId: string,
    adminId: string
  ) {

    const systemControl = await this.getSystemControl();

    if (systemControl.withdrawalsFrozen) {
      throw new AppError(
        'Withdrawal approvals are temporarily disabled.',
        503
      );
    }

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

      const wallet = await tx.wallet.findUnique({
        where: { id: request.walletId },
      });

      if (!wallet) throw new AppError('Wallet not found', 404);

      if (wallet.isFrozen) {
        throw new AppError('Wallet frozen. Cannot approve.', 403);
      }

      if (Number(wallet.balance) < Number(request.amount)) {
        throw new AppError('Insufficient balance at approval time', 400);
      }

      await tx.wallet.update({
        where: { id: wallet.id },
        data: {
          balance: { decrement: request.amount },
        },
      });

      await tx.transaction.create({
        data: {
          userId: request.agentId,
          amount: request.amount,
          type: TransactionType.DEBIT,
          status: TransactionStatus.SUCCESS,
          referenceId: request.id,
        },
      });

      await tx.withdrawalRequest.update({
        where: { id: request.id },
        data: {
          status: 'APPROVED',
          approvedBy: adminId,
          approvedAt: new Date(),
        },
      });

      await tx.auditLog.create({
        data: {
          userId: adminId,
          action: 'UPDATE',
          resourceType: 'WITHDRAWAL_APPROVED',
          resourceId: request.id,
        },
      });

    });

    logger.info(`Withdrawal approved → ${requestId}`);

    return { status: 'APPROVED' };
  }

  //////////////////////////////////////////////////////
  // REJECT WITHDRAWAL
  //////////////////////////////////////////////////////

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
      },
    });

    logger.warn(`Withdrawal rejected → ${requestId}`);

    return { status: 'REJECTED' };
  }

  //////////////////////////////////////////////////////
  // TRANSACTION HISTORY
  //////////////////////////////////////////////////////

  static async getHistory(
    userId: string,
    page: number = 1,
    limit: number = 10
  ) {

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
      })),
      total: history.total,
      currentPage: page,
      totalPages: history.totalPages,
    };
  }
}