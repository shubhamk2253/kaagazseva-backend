import { prisma } from '../../config/database';
import { TransactionStatus, TransactionType } from '@prisma/client';
import { AppError } from '../../core/AppError';

/**
 * KAAGAZSEVA - Wallet Repository
 * Financially safe ledger engine.
 * All monetary values stored in RUPEES (Decimal).
 */

export class WalletRepository {

  //////////////////////////////////////////////////////
  // GET WALLET
  //////////////////////////////////////////////////////

  static async findByUserId(userId: string) {

    const wallet = await prisma.wallet.findUnique({
      where: { userId },
      include: {
        user: true,
      },
    });

    if (!wallet) {
      throw new AppError('Wallet not found', 404);
    }

    return wallet;
  }

  //////////////////////////////////////////////////////
  // ATOMIC DEBIT
  //////////////////////////////////////////////////////

  static async createDebit(
    userId: string,
    amount: number,
    description: string,
    referenceId: string
  ) {

    if (amount <= 0) {
      throw new AppError('Invalid debit amount', 400);
    }

    return prisma.$transaction(async (tx) => {

      const existing = await tx.transaction.findFirst({
        where: { referenceId },
      });

      if (existing) {
        throw new AppError('Duplicate transaction detected', 409);
      }

      const result = await tx.wallet.updateMany({
        where: {
          userId,
          balance: { gte: amount },
        },
        data: {
          balance: { decrement: amount },
        },
      });

      if (result.count === 0) {
        throw new AppError('Insufficient wallet balance', 400);
      }

      const wallet = await tx.wallet.findUnique({
        where: { userId },
        include: { user: true },
      });

      if (!wallet) {
        throw new AppError('Wallet not found after debit', 500);
      }

      const transaction = await tx.transaction.create({
        data: {
          userId,
          amount,
          type: TransactionType.DEBIT,
          status: TransactionStatus.SUCCESS,
          referenceId,
        },
      });

      return { wallet, transaction };
    });
  }

  //////////////////////////////////////////////////////
  // ATOMIC CREDIT
  //////////////////////////////////////////////////////

  static async createCredit(
    userId: string,
    amount: number,
    description: string,
    referenceId?: string
  ) {

    if (amount <= 0) {
      throw new AppError('Invalid credit amount', 400);
    }

    return prisma.$transaction(async (tx) => {

      if (referenceId) {

        const existing = await tx.transaction.findFirst({
          where: { referenceId },
        });

        if (existing) {
          throw new AppError('Duplicate transaction detected', 409);
        }
      }

      const wallet = await tx.wallet.findUnique({
        where: { userId },
      });

      if (!wallet) {
        throw new AppError('Wallet not found', 404);
      }

      const updatedWallet = await tx.wallet.update({
        where: { userId },
        data: {
          balance: { increment: amount },
        },
      });

      const transaction = await tx.transaction.create({
        data: {
          userId,
          amount,
          type: TransactionType.CREDIT,
          status: TransactionStatus.SUCCESS,
          referenceId,
        },
      });

      return { wallet: updatedWallet, transaction };
    });
  }

  //////////////////////////////////////////////////////
  // TRANSACTION HISTORY
  //////////////////////////////////////////////////////

  static async getTransactionHistory(
    userId: string,
    skip: number,
    take: number
  ) {

    const [transactions, total] = await prisma.$transaction([
      prisma.transaction.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      prisma.transaction.count({
        where: { userId },
      }),
    ]);

    return {
      transactions,
      total,
      totalPages: Math.ceil(total / take),
    };
  }
}