import { Request, Response, NextFunction } from 'express';
import { EscalationService } from './escalation.service';
import { AppError } from '../../core/AppError';
import logger from '../../core/logger';

export class EscalationController {

  //////////////////////////////////////////////////////
  // ESCALATE CASE
  //////////////////////////////////////////////////////

  static async escalate(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {

      const { caseId } = req.params;

      if (!caseId) {
        throw new AppError('Case ID is required', 400);
      }

      const escalatedById = req.user?.id;

      if (!escalatedById) {
        throw new AppError('Unauthorized', 401);
      }

      const result = await EscalationService.escalate(
        caseId,
        escalatedById
      );

      return res.status(200).json({
        success: true,
        ...result,
      });

    } catch (error) {
      logger.error('Escalation error', error);
      next(error);
    }
  }

}