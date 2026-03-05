import { z } from 'zod';

//////////////////////////////////////////////////////
// 1️⃣ CUSTOMER REFUND REQUEST
//////////////////////////////////////////////////////

export const refundRequestSchema = z.object({
  applicationId: z.string().uuid(),
  amount: z.number().positive().optional(),
  reason: z
    .string()
    .min(5, 'Reason must be at least 5 characters'),
});

//////////////////////////////////////////////////////
// 2️⃣ ADMIN REVIEW
//////////////////////////////////////////////////////

export const refundReviewSchema = z.object({
  decision: z.enum(['APPROVE', 'REJECT']),
});

//////////////////////////////////////////////////////
// 3️⃣ PROCESS REFUND
//////////////////////////////////////////////////////

export const refundProcessSchema = z.object({
  refundId: z.string().uuid().optional(),
});