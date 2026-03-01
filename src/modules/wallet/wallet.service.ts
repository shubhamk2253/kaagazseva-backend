import { WalletRepository } from './wallet.repository';
import { AppError } from '../../core/AppError';
import logger from '../../core/logger';

/**
 * KAAGAZSEVA - Wallet Service
 * Business layer for financial operations.
 * All currency handled in PAISE (integer).
 */
export class WalletService {

  /* =====================================================
     Get Wallet Balance
  ===================================================== */
  static async getBalance(userId: string) {
    const wallet = await WalletRepository.findByUserId(userId);

    const LOW_BALANCE_THRESHOLD = 5000; // ₹50 (in paise)

    const balance = Number(wallet.balance);

    return {
      balance,
      balanceInRupees: balance / 100,
      isLowBalance: balance < LOW_BALANCE_THRESHOLD,
      lastUpdated: wallet.updatedAt,
    };
  }

  /* =====================================================
     Top-Up Wallet (Credit)
     Called AFTER successful payment gateway verification
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

    const description = `Wallet top-up via ${paymentMethod}`;

    const result = await WalletRepository.createCredit(
      userId,
      amountInPaise,
      description,
      externalReference
    );

    const updatedBalance = Number(result.wallet.balance);

    logger.info({
      event: 'WALLET_TOPUP',
      userId,
      amountInPaise,
      paymentMethod,
    });

    return {
      walletBalance: updatedBalance,
      walletBalanceInRupees: updatedBalance / 100,
      transactionId: result.transaction.id,
    };
  }

  /* =====================================================
     Pay For Service (Debit)
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

    const description = `Payment for ${serviceType} application`;

    const result = await WalletRepository.createDebit(
      userId,
      amountInPaise,
      description,
      applicationId // idempotency reference
    );

    const updatedBalance = Number(result.wallet.balance);

    logger.info({
      event: 'SERVICE_PAYMENT',
      userId,
      applicationId,
      amountInPaise,
    });

    return {
      walletBalance: updatedBalance,
      walletBalanceInRupees: updatedBalance / 100,
      transactionId: result.transaction.id,
    };
  }

  /* =====================================================
     Withdrawal Request (Agent Earnings)
  ===================================================== */
  static async withdraw(
    userId: string,
    amountInPaise: number
  ) {
    if (!amountInPaise || amountInPaise <= 0) {
      throw new AppError('Invalid withdrawal amount', 400);
    }

    const description = `Wallet withdrawal request`;

    const result = await WalletRepository.createDebit(
      userId,
      amountInPaise,
      description,
      `withdraw-${Date.now()}`
    );

    const updatedBalance = Number(result.wallet.balance);

    logger.warn({
      event: 'WITHDRAWAL_REQUEST',
      userId,
      amountInPaise,
    });

    return {
      walletBalance: updatedBalance,
      walletBalanceInRupees: updatedBalance / 100,
      transactionId: result.transaction.id,
      status: 'PENDING_SETTLEMENT',
    };
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
      wallet.id,
      skip,
      limit
    );

    return {
      transactions: history.transactions.map((t) => {
        const amount = Number(t.amount);
        return {
          ...t,
          amount,
          amountInRupees: amount / 100,
        };
      }),
      total: history.total,
      currentPage: page,
      totalPages: history.totalPages,
    };
  }
}