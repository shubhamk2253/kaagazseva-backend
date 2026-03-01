import { prisma } from '../../config/database';
import { AuditAction } from '@prisma/client';

/**
 * KAAGAZSEVA - Enterprise Audit Repository
 * Immutable forensic ledger.
 */
export class AuditRepository {

  static async log(data: {
    userId?: string;
    action: AuditAction;
    resourceType: string;
    resourceId?: string;
    method: string;
    path: string;
    oldData?: any;
    newData?: any;
    ip?: string;
    userAgent?: string;
    requestId?: string;
    statusCode: number;
    success?: boolean;
  }) {
    return prisma.auditLog.create({
      data: {
        userId: data.userId,
        action: data.action,
        resourceType: data.resourceType,
        resourceId: data.resourceId,
        method: data.method,
        path: data.path,
        oldData: data.oldData || null,
        newData: data.newData || null,
        ip: data.ip,
        userAgent: data.userAgent,
        requestId: data.requestId,
        statusCode: data.statusCode,
        success: data.success ?? true,
      },
    });
  }

  static async getResourceHistory(resourceType: string, resourceId: string) {
    return prisma.auditLog.findMany({
      where: { resourceType, resourceId },
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { name: true, role: true } } }
    });
  }

  static async getUserActions(userId: string, limit = 50) {
    return prisma.auditLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  static async getSecurityEvents(limit = 100) {
    return prisma.auditLog.findMany({
      where: { success: false },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }
}