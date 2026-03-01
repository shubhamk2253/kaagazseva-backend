import { Response } from 'express';
import { ApplicationService } from './application.service';
import { asyncHandler } from '../../core/asyncHandler';
import { ApiResponse } from '../../core/ApiResponse';
import { RequestWithUser } from '../../core/types';
import { ApplicationStatus, ServiceMode } from '@prisma/client';
import { StorageService } from '../../infrastructure/storage/storage.service';
import { AppError } from '../../core/AppError';
import logger from '../../core/logger';

/**
 * KAAGAZSEVA - Application Controller
 */
export class ApplicationController {

  /* =====================================================
     POST /api/v1/applications
     Citizen submits new application with S3 uploads
  ===================================================== */
  static apply = asyncHandler(async (req: RequestWithUser, res: Response) => {

    const userId = req.user!.userId;

    const {
      serviceType,
      state,
      district,
      govtFee,
      mode,
      customerLat,
      customerLng,
      deliveryAddress,
    } = req.body;

    const files = req.files as Express.Multer.File[];

    //////////////////////////////////////////////////////
    // VALIDATION
    //////////////////////////////////////////////////////

    if (!serviceType || !state || !district || !govtFee || !mode) {
      throw new AppError('Missing required application fields', 400);
    }

    if (!files || files.length === 0) {
      throw new AppError('At least one document must be uploaded', 400);
    }

    if (!Object.values(ServiceMode).includes(mode)) {
      throw new AppError('Invalid service mode', 400);
    }

    //////////////////////////////////////////////////////
    // 1️⃣ Upload Files to S3
    //////////////////////////////////////////////////////

    const uploadedDocuments: Record<string, any> = {};

    for (const file of files) {
      const uploadResult = await StorageService.uploadDocument(
        file,
        'applications',
        userId
      );

      uploadedDocuments[file.originalname] = {
        s3Key: uploadResult.key,
        fileName: file.originalname,
        uploadedAt: new Date().toISOString(),
      };
    }

    //////////////////////////////////////////////////////
    // 2️⃣ Create Application
    //////////////////////////////////////////////////////

    const application = await ApplicationService.createApplication(
      userId,
      {
        serviceType,
        state,
        district,
        govtFee: Number(govtFee),
        mode,
        customerLat: customerLat ? Number(customerLat) : undefined,
        customerLng: customerLng ? Number(customerLng) : undefined,
        deliveryAddress,
        documents: uploadedDocuments,
      }
    );

    logger.info(
      `Application ${application.id} created by ${userId} | RequestID: ${req.requestId}`
    );

    return ApiResponse.success(
      res,
      'Application submitted successfully',
      application,
      201
    );
  });

  /* =====================================================
     GET /api/v1/applications/me
     Citizen dashboard
  ===================================================== */
  static getMyApplications = asyncHandler(
    async (req: RequestWithUser, res: Response) => {

      const userId = req.user!.userId;

      const filters = {
        customerId: userId, // ✅ FIXED (was userId)
        status: req.query.status as ApplicationStatus | undefined,
        serviceType: req.query.serviceType as string | undefined,
        page: Number(req.query.page) || 1,
        limit: Number(req.query.limit) || 10,
      };

      const result = await ApplicationService.listApplications(filters);

      return ApiResponse.success(
        res,
        'Your applications retrieved successfully',
        result
      );
    }
  );

  /* =====================================================
     GET /api/v1/applications
     Admin / Agent listing
  ===================================================== */
  static listApplications = asyncHandler(
    async (req: RequestWithUser, res: Response) => {

      const filters = {
        status: req.query.status as ApplicationStatus | undefined,
        serviceType: req.query.serviceType as string | undefined,
        agentId: req.query.agentId as string | undefined,
        page: Number(req.query.page) || 1,
        limit: Number(req.query.limit) || 10,
      };

      const result = await ApplicationService.listApplications(filters);

      return ApiResponse.success(
        res,
        'Applications retrieved successfully',
        result
      );
    }
  );

  /* =====================================================
     GET /api/v1/applications/:id
     Secure detailed view
  ===================================================== */
  static getDetails = asyncHandler(
    async (req: RequestWithUser, res: Response) => {

      const { id } = req.params;
      const { userId, role } = req.user!;

      const details =
        await ApplicationService.getApplicationDetails(
          id,
          userId,
          role
        );

      return ApiResponse.success(
        res,
        'Application details retrieved successfully',
        details
      );
    }
  );

  /* =====================================================
     PATCH /api/v1/applications/:id/status
     Agent/Admin status update
  ===================================================== */
  static updateStatus = asyncHandler(
    async (req: RequestWithUser, res: Response) => {

      const { id } = req.params;
      const { status } = req.body;
      const updaterId = req.user!.userId;

      if (!Object.values(ApplicationStatus).includes(status)) {
        throw new AppError('Invalid application status', 400);
      }

      const updated = await ApplicationService.updateStatus(
        id,
        status as ApplicationStatus,
        updaterId
      );

      logger.info(
        `Application ${id} updated to ${status} by ${updaterId}`
      );

      return ApiResponse.success(
        res,
        `Application status updated to ${status}`,
        updated
      );
    }
  );
}