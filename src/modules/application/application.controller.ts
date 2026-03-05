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

  //////////////////////////////////////////////////////
  // CREATE DRAFT
  //////////////////////////////////////////////////////

  static createDraft = asyncHandler(
    async (req: RequestWithUser, res: Response) => {

      const userId = req.user!.userId;

      const {
        serviceId,
        stateId,
        pincode,
        mode,
        customerLat,
        customerLng,
        deliveryAddress,
      } = req.body;

      if (!serviceId || !stateId || !pincode || !mode) {
        throw new AppError('Missing required fields', 400);
      }

      if (!Object.values(ServiceMode).includes(mode)) {
        throw new AppError('Invalid service mode', 400);
      }

      if (!/^[0-9]{6}$/.test(pincode)) {
        throw new AppError('Invalid pincode format', 400);
      }

      const result = await ApplicationService.createDraft(
        userId,
        {
          serviceId,
          stateId,
          pincode,
          mode,
          customerLat,
          customerLng,
          deliveryAddress,
        }
      );

      logger.info(
        `Draft created by ${userId} | Application=${result.applicationId} | RequestID=${req.requestId}`
      );

      return ApiResponse.success(
        res,
        'Draft created successfully',
        result,
        201
      );
    }
  );

  //////////////////////////////////////////////////////
  // UPLOAD DOCUMENTS
  //////////////////////////////////////////////////////

  static uploadDocuments = asyncHandler(
    async (req: RequestWithUser, res: Response) => {

      const { id } = req.params;
      const userId = req.user!.userId;
      const files = req.files as Express.Multer.File[];

      if (!files || files.length === 0) {
        throw new AppError('At least one document required', 400);
      }

      const uploads = await Promise.all(
        files.map(file =>
          StorageService.uploadDocument(file, 'applications', userId)
        )
      );

      const documents = uploads.map((upload, index) => ({
        name: files[index].originalname,
        fileUrl: upload.key,
      }));

      const updated =
        await ApplicationService.attachDocuments(
          id,
          userId,
          documents
        );

      logger.info(
        `Documents uploaded for draft ${id} by ${userId}`
      );

      return ApiResponse.success(
        res,
        'Documents uploaded successfully',
        updated
      );
    }
  );

  //////////////////////////////////////////////////////
  // CUSTOMER DASHBOARD
  //////////////////////////////////////////////////////

  static getMyApplications = asyncHandler(
    async (req: RequestWithUser, res: Response) => {

      const userId = req.user!.userId;

      const filters = {
        customerId: userId,
        status: req.query.status as ApplicationStatus | undefined,
        serviceId: req.query.serviceId as string | undefined,
        page: Number(req.query.page) || 1,
        limit: Number(req.query.limit) || 10,
      };

      const result =
        await ApplicationService.listApplications(filters);

      return ApiResponse.success(
        res,
        'Your applications retrieved successfully',
        result
      );
    }
  );

  //////////////////////////////////////////////////////
  // STAFF DASHBOARD
  //////////////////////////////////////////////////////

  static listApplications = asyncHandler(
    async (req: RequestWithUser, res: Response) => {

      const filters = {
        status: req.query.status as ApplicationStatus | undefined,
        serviceId: req.query.serviceId as string | undefined,
        agentId: req.query.agentId as string | undefined,
        page: Number(req.query.page) || 1,
        limit: Number(req.query.limit) || 10,
      };

      const result =
        await ApplicationService.listApplications(filters);

      return ApiResponse.success(
        res,
        'Applications retrieved successfully',
        result
      );
    }
  );

  //////////////////////////////////////////////////////
  // APPLICATION DETAIL
  //////////////////////////////////////////////////////

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

  //////////////////////////////////////////////////////
  // UPDATE STATUS
  //////////////////////////////////////////////////////

  static updateStatus = asyncHandler(
    async (req: RequestWithUser, res: Response) => {

      const { id } = req.params;
      const { status } = req.body;
      const updaterId = req.user!.userId;

      if (!Object.values(ApplicationStatus).includes(status)) {
        throw new AppError('Invalid application status', 400);
      }

      const updated =
        await ApplicationService.updateStatus(
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