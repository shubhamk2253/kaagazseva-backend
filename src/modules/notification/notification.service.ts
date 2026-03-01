import { NotificationRepository } from './notification.repository';
import { CreateNotificationInput } from './notification.types';
import { AppError } from '../../core/AppError';
import logger from '../../core/logger';

/**
 * KAAGAZSEVA - Notification Service
 * Orchestrates user alerts and in-app notifications.
 */
export class NotificationService {

  /* =====================================================
     SYSTEM TRIGGER (Internal Use)
     Used by Application, Wallet, Ticket modules
  ===================================================== */
  static async notify(data: CreateNotificationInput) {
    try {
      const notification = await NotificationRepository.create(data);

      // 🚀 Future Upgrade Points:
      // - Socket.io real-time emit
      // - Firebase Push (FCM)
      // - Email Queue trigger
      // - WhatsApp Integration

      return notification;
    } catch (error) {
      logger.error('Notification creation failed:', error);

      // 🔐 Important Design Decision:
      // Notifications should NEVER break core flows.
      // If payment succeeds, it must not fail due to notification error.
      return null;
    }
  }

  /* =====================================================
     GET USER NOTIFICATIONS
     Paginated
  ===================================================== */
  static async getUserNotifications(
    userId: string,
    page: number = 1,
    limit: number = 10
  ) {
    const skip = (page - 1) * limit;

    const { notifications, total } =
      await NotificationRepository.findByUserId(userId, skip, limit);

    return {
      notifications,
      total,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
    };
  }

  /* =====================================================
     MARK SINGLE NOTIFICATION AS READ
  ===================================================== */
  static async markAsRead(notificationId: string, userId: string) {
    const notification = await NotificationRepository.findById(notificationId);

    if (!notification) {
      throw new AppError('Notification not found', 404);
    }

    if (notification.userId !== userId) {
      throw new AppError('Unauthorized access to notification', 403);
    }

    return NotificationRepository.updateReadStatus(notificationId, true);
  }

  /* =====================================================
     MARK ALL AS READ
  ===================================================== */
  static async markAllAsRead(userId: string) {
    return NotificationRepository.markAllRead(userId);
  }
}