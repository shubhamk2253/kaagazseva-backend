import { Response } from 'express';
import { PaymentService } from './payment.service';
import { asyncHandler } from '../../core/asyncHandler';
import { ApiResponse } from '../../core/ApiResponse';
import { RequestWithUser } from '../../core/types';
import { AppError } from '../../core/AppError';
import logger from '../../core/logger';

/**
 * KAAGAZSEVA - Payment Controller
 * Phase 5B Hardened
 */

export class PaymentController {

  //////////////////////////////////////////////////////
  // 1️⃣ CREATE PAYMENT ORDER
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
  // 2️⃣ VERIFY PAYMENT (Idempotent Safe)
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
}