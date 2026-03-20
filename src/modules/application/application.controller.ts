import { Response }             from 'express';
import { ApplicationService }   from './application.service';
import { asyncHandler }         from '../../core/asyncHandler';
import { ApiResponse }          from '../../core/ApiResponse';
import { AuthenticatedRequest } from '../../core/types';
import { ApplicationStatus }    from '@prisma/client';
import { StorageService }       from '../../providers/storage.service';
import { AppError }             from '../../core/AppError';
import logger                   from '../../core/logger';

/**
 * KAAGAZSEVA - Application Controller
 * Validation handled by validate.middleware in routes
 * No manual validation in controller
 */

export class ApplicationController {

  /* =====================================================
     POST /api/v1/applications
     Create application draft
  ===================================================== */

  static createDraft = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const userId = req.user.userId;
      const result = await ApplicationService.createDraft(userId, req.body);

      logger.info({
        event:         'APPLICATION_DRAFT_CREATED',
        userId,
        applicationId: result.applicationId,
        requestId:     req.requestId,
      });

      return ApiResponse.created(res, 'Draft created successfully', result);
    }
  );

  /* =====================================================
     POST /api/v1/applications/:id/documents
     Upload documents to application
  ===================================================== */

  static uploadDocuments = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const { id }   = req.params;
      const userId   = req.user.userId;
      const files    = req.files as Express.Multer.File[];

      if (!files || files.length === 0) {
        throw new AppError('At least one document required', 400, true, 'FILE_REQUIRED');
      }

      const uploads = await Promise.all(
        files.map(file =>
          StorageService.uploadDocument(file, 'applications', userId, id)
        )
      );

      const documents = uploads.map((upload, index) => ({
        name:     files[index].originalname,
        fileUrl:  upload.key,
        fileSize: files[index].size,
        mimeType: files[index].mimetype,
      }));

      const updated = await ApplicationService.attachDocuments(
        id, userId, documents
      );

      logger.info({
        event:         'APPLICATION_DOCUMENTS_UPLOADED',
        applicationId: id,
        userId,
        count:         files.length,
        requestId:     req.requestId,
      });

      return ApiResponse.success(res, 'Documents uploaded successfully', updated);
    }
  );

  /* =====================================================
     GET /api/v1/applications/my
     Customer's own applications (paginated)
  ===================================================== */

  static getMyApplications = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const userId = req.user.userId;

      const filters = {
        customerId: userId,
        status:     req.query.status as ApplicationStatus | undefined,
        serviceId:  req.query.serviceId as string | undefined,
        page:       Number(req.query.page)  || 1,
        limit:      Number(req.query.limit) || 10,
      };

      const result = await ApplicationService.listApplications(filters);

      return ApiResponse.paginated(
        res,
        'Your applications retrieved',
        result.items,
        result.meta
      );
    }
  );

  /* =====================================================
     GET /api/v1/applications
     Staff/admin application list (paginated)
  ===================================================== */

  static listApplications = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const filters = {
        status:    req.query.status    as ApplicationStatus | undefined,
        serviceId: req.query.serviceId as string | undefined,
        agentId:   req.query.agentId   as string | undefined,
        page:      Number(req.query.page)  || 1,
        limit:     Number(req.query.limit) || 10,
      };

      const result = await ApplicationService.listApplications(filters);

      return ApiResponse.paginated(
        res,
        'Applications retrieved',
        result.items,
        result.meta
      );
    }
  );

  /* =====================================================
     GET /api/v1/applications/:id
     Application detail
  ===================================================== */

  static getDetails = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const { id }          = req.params;
      const { userId, role } = req.user;

      const details = await ApplicationService.getApplicationDetails(
        id, userId, role
      );

      return ApiResponse.success(res, 'Application details retrieved', details);
    }
  );

  /* =====================================================
     PATCH /api/v1/applications/:id/status
     Update application status
     Status transition validation is in ApplicationService
  ===================================================== */

  static updateStatus = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const { id }     = req.params;
      const { status } = req.body;
      const updaterId  = req.user.userId;
      const role       = req.user.role;

      const updated = await ApplicationService.updateStatus(
        id, status as ApplicationStatus, updaterId, role
      );

      logger.info({
        event:         'APPLICATION_STATUS_UPDATED',
        applicationId: id,
        status,
        updatedBy:     updaterId,
        requestId:     req.requestId,
      });

      return ApiResponse.success(
        res,
        `Application status updated to ${status}`,
        updated
      );
    }
  );

  /* =====================================================
     POST /api/v1/applications/:id/confirm
     Customer confirms completion → triggers payout
  ===================================================== */

  static confirmCompletion = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const { id }   = req.params;
      const userId   = req.user.userId;

      const result = await ApplicationService.confirmCompletion(id, userId);

      logger.info({
        event:         'APPLICATION_COMPLETION_CONFIRMED',
        applicationId: id,
        customerId:    userId,
        requestId:     req.requestId,
      });

      return ApiResponse.success(
        res,
        'Completion confirmed. Payment released to agent.',
        result
      );
    }
  );

  /* =====================================================
     POST /api/v1/applications/:id/cancel
     Cancel application
  ===================================================== */

  static cancel = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const { id }   = req.params;
      const userId   = req.user.userId;
      const { reason } = req.body;

      const result = await ApplicationService.cancelApplication(
        id, userId, reason
      );

      logger.info({
        event:         'APPLICATION_CANCELLED',
        applicationId: id,
        cancelledBy:   userId,
        requestId:     req.requestId,
      });

      return ApiResponse.success(res, 'Application cancelled', result);
    }
  );
}