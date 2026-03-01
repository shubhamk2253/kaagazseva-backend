/**
 * KAAGAZSEVA - Notification Types
 * Managing system alerts, user communication & activity tracking.
 */

import  {NotificationType} from '@prisma/client';

/* =========================================
   Core Notification Model (DB Shape)
========================================= */

export interface NotificationDetail {
  id: string;
  userId: string;
  type: NotificationType;   // ✅ Use Prisma enum
  title: string;
  message: string;
  isRead: boolean;
  metadata?: {
    applicationId?: string;
    ticketId?: string;
    transactionId?: string;
  };
  createdAt: Date;
}

/* =========================================
   Create Notification (Internal Use)
========================================= */

export interface CreateNotificationInput {
  userId: string;
  type: NotificationType;   // ✅ Use Prisma enum
  title: string;
  message: string;
  metadata?: {
    applicationId?: string;
    ticketId?: string;
    transactionId?: string;
  };
}

/* =========================================
   Notification Query Filters
========================================= */

export interface NotificationFilters {
  isRead?: boolean;
  page?: number;
  limit?: number;
}

/* =========================================
   Paginated Notification Response
========================================= */

export interface PaginatedNotificationResponse {
  notifications: NotificationDetail[];
  total: number;
  totalPages: number;
  currentPage: number;
}