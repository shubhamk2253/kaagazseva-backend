import { Response, NextFunction } from 'express';
import { FounderVisibilityService } from './founder-visibility.service';
import { RequestWithUser } from '../../core/types';

export class FounderVisibilityController {

  static async overview(
    req: RequestWithUser,
    res: Response,
    next: NextFunction
  ) {
    try {
      const data = await FounderVisibilityService.getOverview();
      res.status(200).json(data);
    } catch (error) {
      next(error);
    }
  }

}