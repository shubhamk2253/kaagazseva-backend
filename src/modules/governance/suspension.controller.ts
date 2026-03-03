import { Response, NextFunction } from 'express';
import { SuspensionService } from './suspension.service';
import { EscalationService } from './escalation.service';
import { RequestWithUser } from '../../core/types';

export class SuspensionController {

  //////////////////////////////////////////////////////
  // 1️⃣ INITIATE
  //////////////////////////////////////////////////////

  static async initiate(
    req: RequestWithUser,
    res: Response,
    next: NextFunction
  ) {
    try {
      const { targetUserId, reason, evidence } = req.body;

      const result = await SuspensionService.initiate(
        targetUserId,
        reason,
        req.user!.userId,
        req.user!.role,
        evidence
      );

      res.status(201).json(result);

    } catch (error) {
      next(error);
    }
  }

  //////////////////////////////////////////////////////
  // 2️⃣ REVIEW
  //////////////////////////////////////////////////////

  static async review(
    req: RequestWithUser,
    res: Response,
    next: NextFunction
  ) {
    try {
      const { caseId } = req.params;
      const { decision } = req.body;

      const result = await SuspensionService.review(
        caseId,
        req.user!.userId,
        decision
      );

      res.status(200).json(result);

    } catch (error) {
      next(error);
    }
  }

  //////////////////////////////////////////////////////
  // 3️⃣ APPEAL
  //////////////////////////////////////////////////////

  static async appeal(
    req: RequestWithUser,
    res: Response,
    next: NextFunction
  ) {
    try {
      const { caseId } = req.params;
      const { message } = req.body;

      const result = await SuspensionService.appeal(
        caseId,
        req.user!.userId,
        message
      );

      res.status(200).json(result);

    } catch (error) {
      next(error);
    }
  }

  //////////////////////////////////////////////////////
  // 4️⃣ ESCALATE
  //////////////////////////////////////////////////////

  static async escalate(
    req: RequestWithUser,
    res: Response,
    next: NextFunction
  ) {
    try {
      const { caseId } = req.params;

      const result = await EscalationService.escalate(
        caseId,
        req.user!.userId
      );

      res.status(200).json(result);

    } catch (error) {
      next(error);
    }
  }

}