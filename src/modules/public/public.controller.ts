import { Response, Request } from 'express';
import { PublicService } from './public.service';
import { asyncHandler } from '../../core/asyncHandler';
import { ApiResponse } from '../../core/ApiResponse';

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
        throw new Error('stateId query parameter is required');
      }

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

  /* =====================================================
     GET /api/v1/public/pincode-validate?pincode=xxxxxx
  ===================================================== */
  static validatePincode = asyncHandler(
    async (req: Request, res: Response) => {

      const { pincode } = req.query;

      const result = await PublicService.validatePincode(
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