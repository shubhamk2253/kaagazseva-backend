import { Response, Request } from 'express';
import { PublicService } from './public.service';
import { asyncHandler } from '../../core/asyncHandler';
import { ApiResponse } from '../../core/ApiResponse';
import { AppError } from '../../core/AppError';

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

      if (!stateId) {
        throw new AppError('stateId query parameter is required', 400);
      }

      const services =
        await PublicService.getServicesByState(
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

      if (!id) {
        throw new AppError('Service id required', 400);
      }

      const documents =
        await PublicService.getServiceDocuments(id);

      return ApiResponse.success(
        res,
        'Service documents retrieved successfully',
        documents
      );
    }
  );

  /* =====================================================
     POST /api/v1/public/pincode
     Detect State + District
  ===================================================== */
  static detectStateFromPincode = asyncHandler(
    async (req: Request, res: Response) => {

      const { pincode } = req.body;

      if (!pincode) {
        throw new AppError('Pincode is required', 400);
      }

      const result =
        await PublicService.validatePincode(
          String(pincode)
        );

      return ApiResponse.success(
        res,
        'Pincode validated successfully',
        result
      );
    }
  );

}