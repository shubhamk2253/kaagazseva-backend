import { z } from 'zod';
import { TransactionType, TransactionStatus } from '@prisma/client';

/**
 * KAAGAZSEVA - Wallet Validation Schemas
 * All monetary values are in RUPEES (decimal allowed).
 */

export const walletSchema = {

  //////////////////////////////////////////////////////
  // Top-up Wallet
  //////////////////////////////////////////////////////

  topUp: z.object({
    body: z.object({

      amount: z
        .number({ required_error: 'Amount is required' })
        .positive('Amount must be greater than zero')
        .min(10, 'Minimum top-up amount is ₹10')
        .max(50000, 'Maximum single top-up is ₹50,000'),

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

  //////////////////////////////////////////////////////
  // Process Service Payment
  //////////////////////////////////////////////////////

  processPayment: z.object({
    body: z.object({

      amount: z
        .number()
        .positive('Amount must be greater than zero'),

      serviceType: z
        .string()
        .min(1, 'Service type required'),

      applicationId: z
        .string()
        .uuid('Invalid Application ID'),

    }),
  }),

  //////////////////////////////////////////////////////
  // Agent Withdrawal
  //////////////////////////////////////////////////////

  withdraw: z.object({
    body: z.object({

      amount: z
        .number()
        .positive('Amount must be greater than zero')
        .min(100, 'Minimum withdrawal amount is ₹100'),

    }),
  }),

  //////////////////////////////////////////////////////
  // STATE_ADMIN - Approve Withdrawal
  //////////////////////////////////////////////////////

  approveWithdrawal: z.object({
    params: z.object({
      id: z.string().uuid('Invalid withdrawal request ID'),
    }),
  }),

  //////////////////////////////////////////////////////
  // STATE_ADMIN - Reject Withdrawal
  //////////////////////////////////////////////////////

  rejectWithdrawal: z.object({
    params: z.object({
      id: z.string().uuid('Invalid withdrawal request ID'),
    }),
    body: z.object({
      reason: z
        .string()
        .min(5, 'Rejection reason must be at least 5 characters')
        .max(500, 'Rejection reason too long'),
    }),
  }),

  //////////////////////////////////////////////////////
  // Transaction Filtering
  //////////////////////////////////////////////////////

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