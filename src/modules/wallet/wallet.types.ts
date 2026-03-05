import { TransactionType, TransactionStatus } from '@prisma/client';

/**
 * KAAGAZSEVA - Wallet Module Types
 */

/* ===============================
   Wallet Snapshot
================================= */
export interface WalletDetail {
  id: string;
  userId: string;
  balance: number;
  updatedAt: Date;
}

/* ===============================
   Transaction Ledger Entry
================================= */
export interface TransactionDetail {
  id: string;
  walletId?: string | null;
  amount: number;
  type: TransactionType;        // CREDIT | DEBIT
  status: TransactionStatus;    // PENDING | SUCCESS | FAILED
  referenceId?: string | null;  // Payment Gateway ID / Application ID
  createdAt: Date;
}

/* ===============================
   Add Funds (Top-up)
================================= */
export interface TopUpInput {
  amount: number;
}

/* ===============================
   Service Payment
================================= */
export interface ProcessPaymentInput {
  amount: number;
  applicationId: string;
  serviceType: string;
}

/* ===============================
   Withdrawal Request
================================= */
export interface WithdrawInput {
  amount: number;
}

/* ===============================
   Admin Financial Filters
================================= */
export interface WalletFilters {
  status?: TransactionStatus;
  type?: TransactionType;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}