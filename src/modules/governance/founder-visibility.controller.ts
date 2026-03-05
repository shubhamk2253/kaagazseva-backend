import { Response } from 'express';
import { FounderVisibilityService } from './founder-visibility.service';
import { asyncHandler } from '../../core/asyncHandler';
import { ApiResponse } from '../../core/ApiResponse';
import { RequestWithUser } from '../../core/types';
import logger from '../../core/logger';

/**
 * KAAGAZSEVA - Founder Visibility Controller
 * Provides system-wide governance overview.
 */
export class FounderVisibilityController {

  //////////////////////////////////////////////////////
  // SYSTEM OVERVIEW
  //////////////////////////////////////////////////////

  static overview = asyncHandler(
    async (req: RequestWithUser, res: Response) => {

      const data = await FounderVisibilityService.getOverview();

      logger.info({
        event: 'FOUNDER_OVERVIEW_ACCESSED',
        userId: req.user?.userId,
        requestId: req.requestId,
      });

      return ApiResponse.success(
        res,
        'Founder system overview retrieved',
        data
      );

    }
  );

}