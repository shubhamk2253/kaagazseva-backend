import { prisma } from '../../config/database';
import { AppError } from '../../core/AppError';
import {
  WithdrawalStatus,
  TransactionStatus,
  TransactionType,
  UserRole,
} from '@prisma/client';
import logger from '../../core/logger';

export class WithdrawalEngine {

  //////////////////////////////////////////////////////
  // 1️⃣ REQUEST WITHDRAWAL (Agent)
  //////////////////////////////////////////////////////

  static async request(agentId: string, amount: number) {

    if (!amount || amount < 100) {
      throw new AppError('Minimum withdrawal amount is ₹100', 400);
    }

    const wallet = await prisma.wallet.findUnique({
      where: { userId: agentId },
    });

    if (!wallet) {
      throw new AppError('Wallet not found', 404);
    }

    if (Number(wallet.balance) < amount) {
      throw new AppError('Insufficient wallet balance', 400);
    }

    // Prevent multiple pending withdrawals
    const existingPending = await prisma.withdrawal.findFirst({
      where: {
        agentId,
        status: WithdrawalStatus.PENDING,
      },
    });

    if (existingPending) {
      throw new AppError('You already have a pending withdrawal', 400);
    }

    const withdrawal = await prisma.withdrawal.create({
      data: {
        agentId,
        amount,
        status: WithdrawalStatus.PENDING,
      },
    });

    logger.info(`Withdrawal requested by ${agentId} for ₹${amount}`);

    return withdrawal;
  }

  //////////////////////////////////////////////////////
  // 2️⃣ APPROVE WITHDRAWAL (Admin - ATOMIC SAFE)
  //////////////////////////////////////////////////////

  static async approve(
    withdrawalId: string,
    adminId: string,
    adminRole: UserRole
  ) {

    if (adminRole !== UserRole.ADMIN) {
      throw new AppError('Only admin can approve withdrawals', 403);
    }

    const withdrawal = await prisma.withdrawal.findUnique({
      where: { id: withdrawalId },
    });

    if (!withdrawal || withdrawal.status !== WithdrawalStatus.PENDING) {
      throw new AppError('Invalid withdrawal request', 400);
    }

    await prisma.$transaction(async (tx) => {

      // 1️⃣ Re-fetch wallet inside transaction
      const wallet = await tx.wallet.findUnique({
        where: { userId: withdrawal.agentId },
      });

      if (!wallet) {
        throw new AppError('Wallet not found', 404);
      }

      if (Number(wallet.balance) < Number(withdrawal.amount)) {
        throw new AppError('Insufficient wallet balance at approval time', 400);
      }

      // 2️⃣ Deduct wallet safely
      await tx.wallet.update({
        where: { userId: withdrawal.agentId },
        data: {
          balance: {
            decrement: Number(withdrawal.amount),
          },
        },
      });

      // 3️⃣ Mark withdrawal approved
      await tx.withdrawal.update({
        where: { id: withdrawalId },
        data: {
          status: WithdrawalStatus.APPROVED,
          processedBy: adminId,
          processedAt: new Date(),
        },
      });

      // 4️⃣ Create DEBIT transaction record
      await tx.transaction.create({
        data: {
          userId: withdrawal.agentId,
          amount: withdrawal.amount,
          type: TransactionType.DEBIT,
          status: TransactionStatus.SUCCESS,
          referenceId: withdrawalId,
        },
      });

    });

    logger.info(`Withdrawal approved → ${withdrawalId}`);

    return { message: 'Withdrawal approved successfully' };
  }

  //////////////////////////////////////////////////////
  // 3️⃣ REJECT WITHDRAWAL (Admin)
  //////////////////////////////////////////////////////

  static async reject(
    withdrawalId: string,
    adminId: string,
    adminRole: UserRole,
    reason: string
  ) {

    if (adminRole !== UserRole.ADMIN) {
      throw new AppError('Only admin can reject withdrawals', 403);
    }

    const withdrawal = await prisma.withdrawal.findUnique({
      where: { id: withdrawalId },
    });

    if (!withdrawal || withdrawal.status !== WithdrawalStatus.PENDING) {
      throw new AppError('Invalid withdrawal request', 400);
    }

    await prisma.withdrawal.update({
      where: { id: withdrawalId },
      data: {
        status: WithdrawalStatus.REJECTED,
        processedBy: adminId,
        processedAt: new Date(),
        failureReason: reason,
      },
    });

    logger.warn(`Withdrawal rejected → ${withdrawalId}`);

    return { message: 'Withdrawal rejected' };
  }
}