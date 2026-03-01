import { Router } from 'express';
import { NotificationController } from './notification.controller';
import { requireAuth } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validate.middleware';
import { notificationSchema } from './notification.schema';

/**
 * KAAGAZSEVA - Notification Routes
 */
const router = Router();

/* =====================================================
   All routes require authentication
===================================================== */
router.use(requireAuth);

/* =====================================================
   GET /api/v1/notifications
   Get user notifications (paginated)
===================================================== */
router.get(
  '/',
  validate(notificationSchema.filter),
  NotificationController.getMyNotifications
);

/* =====================================================
   PATCH /api/v1/notifications/:id/read
   Mark single notification as read
===================================================== */
router.patch(
  '/:id/read',
  NotificationController.markAsRead
);

/* =====================================================
   PATCH /api/v1/notifications/read-all
   Mark all notifications as read
===================================================== */
router.patch(
  '/read-all',
  NotificationController.markAllRead
);

export default router;