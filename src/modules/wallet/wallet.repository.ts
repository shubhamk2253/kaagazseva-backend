import { prisma } from '../../config/database';
import { TransactionStatus, TransactionType } from '@prisma/client';
import { AppError } from '../../core/AppError';

/**
 * KAAGAZSEVA - Wallet Repository
 * Financially safe ledger engine.
 * All monetary values are stored in PAISE (integer).
 */
export class WalletRepository {

  /* =====================================================
     Get Wallet By User (Include User for Governance)
  ===================================================== */
  static async findByUserId(userId: string) {
    const wallet = await prisma.wallet.findUnique({
      where: { userId },
      include: {
        user: true, // 🔥 REQUIRED for withdrawal governance check
      },
    });

    if (!wallet) {
      throw new AppError('Wallet not found', 404);
    }

    return wallet;
  }

  /* =====================================================
     Atomic Debit (Race-Condition Safe)
  ===================================================== */
  static async createDebit(
    userId: string,
    amountInPaise: number,
    description: string,
    referenceId: string
  ) {
    if (amountInPaise <= 0) {
      throw new AppError('Invalid debit amount', 400);
    }

    return prisma.$transaction(async (tx) => {

      //////////////////////////////////////////////////////
      // 1️⃣ Idempotency Check
      //////////////////////////////////////////////////////

      const existing = await tx.transaction.findFirst({
        where: { referenceId },
      });

      if (existing) {
        throw new AppError('Duplicate transaction detected', 409);
      }

      //////////////////////////////////////////////////////
      // 2️⃣ Atomic Balance Decrement
      //////////////////////////////////////////////////////

      const result = await tx.wallet.updateMany({
        where: {
          userId,
          balance: { gte: amountInPaise },
        },
        data: {
          balance: { decrement: amountInPaise },
        },
      });

      if (result.count === 0) {
        throw new AppError('Insufficient wallet balance', 400);
      }

      //////////////////////////////////////////////////////
      // 3️⃣ Fetch Updated Wallet
      //////////////////////////////////////////////////////

      const wallet = await tx.wallet.findUnique({
        where: { userId },
        include: { user: true },
      });

      if (!wallet) {
        throw new AppError('Wallet not found after debit', 500);
      }

      //////////////////////////////////////////////////////
      // 4️⃣ Ledger Entry
      //////////////////////////////////////////////////////

      const transaction = await tx.transaction.create({
        data: {
          userId,
          amount: amountInPaise,
          type: TransactionType.DEBIT,
          status: TransactionStatus.SUCCESS,
          referenceId,
        },
      });

      return { wallet, transaction };
    });
  }

  /* =====================================================
     Atomic Credit
  ===================================================== */
  static async createCredit(
    userId: string,
    amountInPaise: number,
    description: string,
    referenceId?: string
  ) {
    if (amountInPaise <= 0) {
      throw new AppError('Invalid credit amount', 400);
    }

    return prisma.$transaction(async (tx) => {

      //////////////////////////////////////////////////////
      // Idempotency Check (Optional)
      //////////////////////////////////////////////////////

      if (referenceId) {
        const existing = await tx.transaction.findFirst({
          where: { referenceId },
        });

        if (existing) {
          throw new AppError('Duplicate transaction detected', 409);
        }
      }

      //////////////////////////////////////////////////////
      // Fetch Wallet
      //////////////////////////////////////////////////////

      const wallet = await tx.wallet.findUnique({
        where: { userId },
      });

      if (!wallet) {
        throw new AppError('Wallet not found', 404);
      }

      //////////////////////////////////////////////////////
      // Increment Balance
      //////////////////////////////////////////////////////

      const updatedWallet = await tx.wallet.update({
        where: { userId },
        data: {
          balance: { increment: amountInPaise },
        },
      });

      //////////////////////////////////////////////////////
      // Ledger Entry
      //////////////////////////////////////////////////////

      const transaction = await tx.transaction.create({
        data: {
          userId,
          amount: amountInPaise,
          type: TransactionType.CREDIT,
          status: TransactionStatus.SUCCESS,
          referenceId,
        },
      });

      return { wallet: updatedWallet, transaction };
    });
  }

  /* =====================================================
     Transaction History (Paginated)
  ===================================================== */
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