import { Response } from 'express';
import { NotificationService } from './notification.service';
import { asyncHandler } from '../../core/asyncHandler';
import { ApiResponse } from '../../core/ApiResponse';
import { RequestWithUser } from '../../core/types';

/**
 * KAAGAZSEVA - Notification Controller
 */
export class NotificationController {

  /* =====================================================
     GET /api/v1/notifications
  ===================================================== */
  static getMyNotifications = asyncHandler(
    async (req: RequestWithUser, res: Response) => {
      const userId = req.user!.userId;

      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 10;

      const result = await NotificationService.getUserNotifications(
        userId,
        page,
        limit
      );

      return ApiResponse.success(
        res,
        'Notifications retrieved successfully',
        result
      );
    }
  );

  /* =====================================================
     PATCH /api/v1/notifications/:id/read
  ===================================================== */
  static markAsRead = asyncHandler(
    async (req: RequestWithUser, res: Response) => {
      const userId = req.user!.userId;
      const { id } = req.params;

      await NotificationService.markAsRead(id, userId);

      return ApiResponse.success(
        res,
        'Notification marked as read',
        null
      );
    }
  );

  /* =====================================================
     PATCH /api/v1/notifications/read-all
  ===================================================== */
  static markAllRead = asyncHandler(
    async (req: RequestWithUser, res: Response) => {
      const userId = req.user!.userId;

      await NotificationService.markAllAsRead(userId);

      return ApiResponse.success(
        res,
        'All notifications marked as read',
        null
      );
    }
  );
}