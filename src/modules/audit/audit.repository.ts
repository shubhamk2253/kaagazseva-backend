import { prisma }      from '../../config/database';
import { AuditAction } from '@prisma/client';

/**
 * KAAGAZSEVA - Audit Repository
 * Immutable forensic ledger.
 * Never update or delete audit records.
 */

export class AuditRepository {

  /* =====================================================
     CREATE AUDIT ENTRY
  ===================================================== */

  static async log(data: {
    userId?:      string;
    action:       AuditAction;
    resourceType: string;
    resourceId?:  string;
    method?:      string;
    path?:        string;
    oldData?:     Record<string, unknown> | null;
    newData?:     Record<string, unknown> | null;
    ip?:          string;
    userAgent?:   string;
    requestId?:   string;
    statusCode?:  number;
    success?:     boolean;
  }) {
    return prisma.auditLog.create({
      data: {
        userId:       data.userId,
        action:       data.action,
        resourceType: data.resourceType,
        resourceId:   data.resourceId,
        method:       data.method,
        path:         data.path,
        oldData:      data.oldData  ?? null,
        newData:      data.newData  ?? null,
        ip:           data.ip,
        userAgent:    data.userAgent,
        requestId:    data.requestId,
        statusCode:   data.statusCode,
        success:      data.success  ?? true,
      },
    });
  }

  /* =====================================================
     RESOURCE HISTORY
     e.g. all changes to a specific application
  ===================================================== */

  static async getResourceHistory(
    resourceType: string,
    resourceId:   string
  ) {
    return prisma.auditLog.findMany({
      where:   { resourceType, resourceId },
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { name: true, role: true } },
      },
    });
  }

  /* =====================================================
     USER ACTION HISTORY
  ===================================================== */

  static async getUserActions(
    userId: string,
    limit:  number = 50
  ) {
    return prisma.auditLog.findMany({
      where:   { userId },
      orderBy: { createdAt: 'desc' },
      take:    limit,
    });
  }

  /* =====================================================
     FAILED/SECURITY EVENTS
     For fraud monitoring dashboard
  ===================================================== */

  static async getSecurityEvents(limit: number = 100) {
    return prisma.auditLog.findMany({
      where:   { success: false },
      orderBy: { createdAt: 'desc' },
      take:    limit,
      include: {
        user: { select: { name: true, role: true } },
      },
    });
  }

  /* =====================================================
     HIGH RISK EVENTS
     Payment, payout, status changes
  ===================================================== */

  static async getHighRiskEvents(limit: number = 50) {
    return prisma.auditLog.findMany({
      where: {
        action: {
          in: [
            AuditAction.PAYMENT,
            AuditAction.PAYOUT,
            AuditAction.STATUS_CHANGE,
          ],
        },
      },
      orderBy: { createdAt: 'desc' },
      take:    limit,
      include: {
        user: { select: { name: true, role: true } },
      },
    });
  }

  /* =====================================================
     RECENT LOGINS
  ===================================================== */

  static async getRecentLogins(limit: number = 50) {
    return prisma.auditLog.findMany({
      where:   { action: AuditAction.LOGIN },
      orderBy: { createdAt: 'desc' },
      take:    limit,
      include: {
        user: { select: { name: true, role: true } },
      },
    });
  }
}