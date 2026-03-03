import { z } from 'zod';

export const paymentSchema = {

  createOrder: z.object({
    body: z.object({
      applicationId: z.string().uuid(),
    }),
  }),

  verifyPayment: z.object({
    body: z.object({
      orderId: z.string(),
      paymentId: z.string(),
      signature: z.string(),
      transactionId: z.string().uuid(),
    }),
  }),

};