import { Response } from 'express';
import { PaymentService } from './payment.service';
import { asyncHandler } from '../../core/asyncHandler';
import { ApiResponse } from '../../core/ApiResponse';
import { RequestWithUser } from '../../core/types';
import { AppError } from '../../core/AppError';

/**
 * KAAGAZSEVA - Payment Controller
 * Handles Razorpay order creation & verification
 */
export class PaymentController {

  //////////////////////////////////////////////////////
  // 1️⃣ CREATE PAYMENT ORDER
  // POST /api/v1/payments/create-order
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
  // 2️⃣ VERIFY PAYMENT
  // POST /api/v1/payments/verify
  //////////////////////////////////////////////////////

  static verifyPayment = asyncHandler(
    async (req: RequestWithUser, res: Response) => {

      const {
        orderId,
        paymentId,
        signature,
        transactionId,
      } = req.body;

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