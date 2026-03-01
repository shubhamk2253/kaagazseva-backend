import { z } from 'zod';
import { TransactionType, TransactionStatus } from '@prisma/client';

/**
 * KAAGAZSEVA - Wallet Validation Schemas
 * All monetary values are in PAISE (integer only).
 */

export const walletSchema = {
  /* ==========================================
     1️⃣ Top-up Wallet (Citizen adds money)
  ========================================== */
  topUp: z.object({
    body: z.object({
      amountInPaise: z
        .number({ required_error: 'Amount is required' })
        .int('Amount must be an integer value (in paise)')
        .positive('Amount must be greater than zero')
        .min(1000, 'Minimum top-up amount is ₹10')
        .max(5_000_000, 'Maximum single top-up is ₹50,000'),

      paymentMethod: z.enum(
        ['UPI', 'CARD', 'NET_BANKING', 'CASH_AGENT'],
        {
          errorMap: () => ({
            message: 'Please select a valid payment method',
          }),
        }
      ),

      externalReference: z.string().optional(),
    }),
  }),

  /* ==========================================
     2️⃣ Process Service Payment (Debit Wallet)
  ========================================== */
  processPayment: z.object({
    body: z.object({
      amountInPaise: z
        .number()
        .int('Amount must be integer in paise')
        .positive('Amount must be greater than zero'),

      serviceType: z.string().min(1, 'Service type required'),

      applicationId: z.string().uuid('Invalid Application ID'),
    }),
  }),

  /* ==========================================
     3️⃣ Withdrawal (Agent Only)
  ========================================== */
  withdraw: z.object({
    body: z.object({
      amountInPaise: z
        .number()
        .int('Amount must be integer in paise')
        .positive('Amount must be greater than zero')
        .min(10000, 'Minimum withdrawal amount is ₹100'),
    }),
  }),

  /* ==========================================
     4️⃣ Transaction Filtering
  ========================================== */
  filterTransactions: z.object({
    query: z.object({
      type: z.nativeEnum(TransactionType).optional(),

      status: z.nativeEnum(TransactionStatus).optional(),

      page: z
        .string()
        .default('1')
        .transform((val) => parseInt(val, 10))
        .pipe(z.number().min(1)),

      limit: z
        .string()
        .default('10')
        .transform((val) => parseInt(val, 10))
        .pipe(z.number().min(1).max(100)),

      startDate: z.string().datetime().optional(),

      endDate: z.string().datetime().optional(),
    }),
  }),
};