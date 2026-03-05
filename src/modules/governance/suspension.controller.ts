import { Response } from 'express';
import { SuspensionService } from './suspension.service';
import { EscalationService } from './escalation.service';
import { asyncHandler } from '../../core/asyncHandler';
import { ApiResponse } from '../../core/ApiResponse';
import { RequestWithUser } from '../../core/types';
import { AppError } from '../../core/AppError';

/**
 * KAAGAZSEVA - Suspension Governance Controller
 */
export class SuspensionController {

  //////////////////////////////////////////////////////
  // 1️⃣ INITIATE
  //////////////////////////////////////////////////////

  static initiate = asyncHandler(
    async (req: RequestWithUser, res: Response) => {

      if (!req.user) {
        throw new AppError('Unauthorized', 401);
      }

      const { targetUserId, reason, evidence } = req.body;

      const result = await SuspensionService.initiate(
        targetUserId,
        reason,
        req.user.userId,
        req.user.role,
        evidence
      );

      return ApiResponse.created(
        res,
        'Suspension case initiated',
        result
      );

    }
  );

  //////////////////////////////////////////////////////
  // 2️⃣ REVIEW
  //////////////////////////////////////////////////////

  static review = asyncHandler(
    async (req: RequestWithUser, res: Response) => {

      if (!req.user) {
        throw new AppError('Unauthorized', 401);
      }

      const { caseId } = req.params;
      const { decision } = req.body;

      const result = await SuspensionService.review(
        caseId,
        req.user.userId,
        decision
      );

      return ApiResponse.success(
        res,
        'Suspension case reviewed',
        result
      );

    }
  );

  //////////////////////////////////////////////////////
  // 3️⃣ APPEAL
  //////////////////////////////////////////////////////

  static appeal = asyncHandler(
    async (req: RequestWithUser, res: Response) => {

      if (!req.user) {
        throw new AppError('Unauthorized', 401);
      }

      const { caseId } = req.params;
      const { message } = req.body;

      const result = await SuspensionService.appeal(
        caseId,
        req.user.userId,
        message
      );

      return ApiResponse.success(
        res,
        'Appeal submitted successfully',
        result
      );

    }
  );

  //////////////////////////////////////////////////////
  // 4️⃣ ESCALATE
  //////////////////////////////////////////////////////

  static escalate = asyncHandler(
    async (req: RequestWithUser, res: Response) => {

      if (!req.user) {
        throw new AppError('Unauthorized', 401);
      }

      const { caseId } = req.params;

      const result = await EscalationService.escalate(
        caseId,
        req.user.userId
      );

      return ApiResponse.success(
        res,
        'Case escalated successfully',
        result
      );

    }
  );

}