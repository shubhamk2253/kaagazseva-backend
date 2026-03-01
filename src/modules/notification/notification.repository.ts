import { prisma } from '../../config/database';
import { CreateNotificationInput } from './notification.types';

/**
 * KAAGAZSEVA - Notification Repository
 * Handles database persistence for user notifications.
 */
export class NotificationRepository {

  /* =====================================================
     CREATE NOTIFICATION
  ===================================================== */
  static async create(data: CreateNotificationInput) {
    return prisma.notification.create({
      data: {
        userId: data.userId,
        type: data.type,
        title: data.title,
        message: data.message,
        metadata: data.metadata || {},
        isRead: false,
      },
    });
  }

  /* =====================================================
     FIND BY ID
  ===================================================== */
  static async findById(id: string) {
    return prisma.notification.findUnique({
      where: { id },
    });
  }

  /* =====================================================
     FIND BY USER (Paginated)
  ===================================================== */
  static async findByUserId(
    userId: string,
    skip: number,
    take: number
  ) {
    const [notifications, total] = await prisma.$transaction([
      prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      prisma.notification.count({
        where: { userId },
      }),
    ]);

    return {
      notifications,
      total,
    };
  }

  /* =====================================================
     UPDATE READ STATUS (Single)
  ===================================================== */
  static async updateReadStatus(id: string, isRead: boolean) {
    return prisma.notification.update({
      where: { id },
      data: { isRead },
    });
  }

  /* =====================================================
     MARK ALL AS READ
  ===================================================== */
  static async markAllRead(userId: string) {
    return prisma.notification.updateMany({
      where: {
        userId,
        isRead: false,
      },
      data: {
        isRead: true,
      },
    });
  }
}