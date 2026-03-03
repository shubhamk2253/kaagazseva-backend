import { Response } from 'express';
import { PublicService } from './public.service';
import { asyncHandler } from '../../core/asyncHandler';
import { ApiResponse } from '../../core/ApiResponse';
import { Request } from 'express';

export class PublicController {

  /* =====================================================
     GET /api/v1/public/states
  ===================================================== */
  static getStates = asyncHandler(async (_req: Request, res: Response) => {

    const states = await PublicService.getActiveStates();

    return ApiResponse.success(
      res,
      'States retrieved successfully',
      states
    );
  });

  /* =====================================================
     GET /api/v1/public/services?stateId=xxx
  ===================================================== */
  static getServicesByState = asyncHandler(
    async (req: Request, res: Response) => {

      const { stateId } = req.query;

      const services = await PublicService.getServicesByState(
        String(stateId)
      );

      return ApiResponse.success(
        res,
        'Services retrieved successfully',
        services
      );
    }
  );

  /* =====================================================
     GET /api/v1/public/services/:id/documents
  ===================================================== */
  static getServiceDocuments = asyncHandler(
    async (req: Request, res: Response) => {

      const { id } = req.params;

      const documents =
        await PublicService.getServiceDocuments(id);

      return ApiResponse.success(
        res,
        'Service documents retrieved successfully',
        documents
      );
    }
  );
}