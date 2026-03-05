import { Response } from 'express';
import { EscalationService } from './escalation.service';
import { asyncHandler } from '../../core/asyncHandler';
import { ApiResponse } from '../../core/ApiResponse';
import { RequestWithUser } from '../../core/types';
import { AppError } from '../../core/AppError';

/**
 * KAAGAZSEVA - Escalation Controller
 * Handles suspension case escalation flow.
 */
export class EscalationController {

  //////////////////////////////////////////////////////
  // ESCALATE CASE
  //////////////////////////////////////////////////////

  static escalate = asyncHandler(
    async (req: RequestWithUser, res: Response) => {

      const { caseId } = req.params;

      if (!caseId) {
        throw new AppError('Case ID is required', 400);
      }

      const escalatedById = req.user?.userId;

      if (!escalatedById) {
        throw new AppError('Unauthorized', 401);
      }

      const result = await EscalationService.escalate(
        caseId,
        escalatedById
      );

      return ApiResponse.success(
        res,
        'Case escalated successfully',
        result
      );

    }
  );

}