import { Response } from 'express';
import { RefundRequestService } from './refund-request.service';
import { asyncHandler } from '../../core/asyncHandler';
import { ApiResponse } from '../../core/ApiResponse';
import { RequestWithUser } from '../../core/types';
import { AppError } from '../../core/AppError';

/**
 * KAAGAZSEVA - Refund Governance Controller
 */
export class RefundController {

  //////////////////////////////////////////////////////
  // 1️⃣ CUSTOMER REQUEST REFUND
  // POST /api/v1/refunds/request
  //////////////////////////////////////////////////////

  static requestRefund = asyncHandler(
    async (req: RequestWithUser, res: Response) => {

      const userId = req.user?.userId;
      if (!userId) {
        throw new AppError('Unauthorized', 401);
      }

      const { applicationId, amount, reason } = req.body;

      const result = await RefundRequestService.requestRefund(
        applicationId,
        userId,
        Number(amount),
        reason
      );

      return ApiResponse.success(
        res,
        'Refund request submitted',
        result
      );
    }
  );

  //////////////////////////////////////////////////////
  // 2️⃣ STATE_ADMIN REVIEW REFUND
  // POST /api/v1/refunds/:id/review
  //////////////////////////////////////////////////////

  static reviewRefund = asyncHandler(
    async (req: RequestWithUser, res: Response) => {

      const reviewerId = req.user?.userId;
      const reviewerRole = req.user?.role;

      if (!reviewerId || !reviewerRole) {
        throw new AppError('Unauthorized', 401);
      }

      const { decision } = req.body;

      const result = await RefundRequestService.reviewRefund(
        req.params.id,
        reviewerId,
        reviewerRole,
        decision
      );

      return ApiResponse.success(
        res,
        'Refund review completed',
        result
      );
    }
  );

  //////////////////////////////////////////////////////
  // 3️⃣ PROCESS APPROVED REFUND
  // POST /api/v1/refunds/:id/process
  //////////////////////////////////////////////////////

  static processRefund = asyncHandler(
    async (req: RequestWithUser, res: Response) => {

      const processorId = req.user?.userId;
      if (!processorId) {
        throw new AppError('Unauthorized', 401);
      }

      const result = await RefundRequestService.processApprovedRefund(
        req.params.id,
        processorId
      );

      return ApiResponse.success(
        res,
        'Refund processed successfully',
        result
      );
    }
  );

}