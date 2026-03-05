import { Response, Request } from 'express';
import { PaymentService } from './payment.service';
import { asyncHandler } from '../../core/asyncHandler';
import { ApiResponse } from '../../core/ApiResponse';
import { RequestWithUser } from '../../core/types';
import { AppError } from '../../core/AppError';
import logger from '../../core/logger';
import { RazorpayProvider } from './razorpay.provider';

/**
 * KAAGAZSEVA - Payment Controller
 * Phase 5B Hardened
 */

export class PaymentController {

  //////////////////////////////////////////////////////
  // CREATE PAYMENT ORDER
  //////////////////////////////////////////////////////

  static createOrder = asyncHandler(
    async (req: RequestWithUser, res: Response) => {

      const userId = req.user?.userId;

      if (!userId) {
        throw new AppError('Unauthorized', 401);
      }

      const { applicationId } = req.body;

      if (!applicationId) {
        throw new AppError('Application ID is required', 400);
      }

      logger.info(
        `Payment order requested | user=${userId} | app=${applicationId}`
      );

      const result = await PaymentService.createPaymentOrder(
        userId,
        applicationId
      );

      return ApiResponse.success(
        res,
        'Payment order created successfully',
        result
      );
    }
  );

  //////////////////////////////////////////////////////
  // VERIFY PAYMENT (Client verification)
  //////////////////////////////////////////////////////

  static verifyPayment = asyncHandler(
    async (req: RequestWithUser, res: Response) => {

      const {
        orderId,
        paymentId,
        signature,
        transactionId,
      } = req.body;

      if (!orderId || !paymentId || !signature || !transactionId) {
        throw new AppError('Invalid verification payload', 400);
      }

      logger.info(
        `Payment verification attempt | tx=${transactionId}`
      );

      const result = await PaymentService.verifyPayment(
        orderId,
        paymentId,
        signature,
        transactionId
      );

      return ApiResponse.success(
        res,
        'Payment verified successfully',
        result
      );
    }
  );

  //////////////////////////////////////////////////////
  // RAZORPAY WEBHOOK HANDLER
  //////////////////////////////////////////////////////

  static webhookHandler = asyncHandler(
    async (req: Request, res: Response) => {

      const signature = req.headers['x-razorpay-signature'] as string;

      if (!signature) {
        throw new AppError('Missing webhook signature', 400);
      }

      const rawBody = req.body;

      const isValid = RazorpayProvider.verifyWebhookSignature(
        rawBody,
        signature
      );

      if (!isValid) {
        throw new AppError('Invalid webhook signature', 400);
      }

      const event = rawBody.event;

      logger.info(`Razorpay webhook received → ${event}`);

      //////////////////////////////////////////////////////
      // Handle payment captured
      //////////////////////////////////////////////////////

      if (event === 'payment.captured') {

        const payment = rawBody.payload.payment.entity;

        const orderId = payment.order_id;
        const paymentId = payment.id;

        const transactionId = payment.notes?.transactionId;

        if (!transactionId) {
          logger.warn('Transaction ID missing in webhook');
          return res.status(200).json({ received: true });
        }

        try {

          await PaymentService.verifyPayment(
            orderId,
            paymentId,
            signature,
            transactionId
          );

        } catch (err) {
          logger.error('Webhook payment verification failed', err);
        }
      }

      return res.status(200).json({ received: true });
    }
  );
}