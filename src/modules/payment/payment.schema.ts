import { z } from 'zod';

/**
 * KAAGAZSEVA - Payment Validation Schemas
 * Hardened input validation
 */

export const paymentSchema = {

  //////////////////////////////////////////////////////
  // CREATE ORDER
  //////////////////////////////////////////////////////

  createOrder: z.object({
    body: z.object({
      applicationId: z
        .string()
        .uuid('Invalid application ID'),
    }).strict(),
  }),

  //////////////////////////////////////////////////////
  // VERIFY PAYMENT
  //////////////////////////////////////////////////////

  verifyPayment: z.object({
    body: z.object({

      orderId: z
        .string()
        .regex(/^order_/, 'Invalid Razorpay order ID'),

      paymentId: z
        .string()
        .regex(/^pay_/, 'Invalid Razorpay payment ID'),

      signature: z
        .string()
        .min(20, 'Invalid signature'),

      transactionId: z
        .string()
        .uuid('Invalid transaction ID'),

    }).strict(),
  }),

};