import { AuditRepository } from './audit.repository';
import logger from '../../core/logger';
import { AuditAction } from '@prisma/client';

/**
 * KAAGAZSEVA - Audit Service
 * Enterprise-grade Black Box Recorder
 */
export class AuditService {

  /**
   * Record a system event safely
   */
  static async record(params: {
    userId?: string;
    action: AuditAction;
    resourceType: 'APPLICATION' | 'WALLET' | 'USER' | 'TICKET' | 'AUTH';
    resourceId?: string;

    method: string;
    path: string;

    oldData?: any;
    newData?: any;

    statusCode: number;
    success?: boolean;

    ip?: string;
    userAgent?: string;
    requestId?: string;
  }) {
    try {
      const sanitizedOld = this.sanitize(params.oldData);
      const sanitizedNew = this.sanitize(params.newData);

      await AuditRepository.log({
        userId: params.userId,
        action: params.action,
        resourceType: params.resourceType,
        resourceId: params.resourceId,
        method: params.method,
        path: params.path,
        oldData: sanitizedOld,
        newData: sanitizedNew,
        statusCode: params.statusCode,
        success: params.success ?? true,
        ip: params.ip,
        userAgent: params.userAgent,
        requestId: params.requestId,
      });

    } catch (error) {
      // 🔒 Audit must NEVER break main system flow
      logger.error('CRITICAL: Audit Log Failure', {
        error,
        context: params,
      });
    }
  }

  /**
   * Remove sensitive data from audit trail
   */
  private static sanitize(payload: any) {
    if (!payload || typeof payload !== 'object') return payload;

    const sensitiveFields = [
      'password',
      'otp',
      'token',
      'refreshToken',
      'secret',
      'cvv',
      'cardNumber',
    ];

    const clean = { ...payload };

    for (const field of sensitiveFields) {
      if (field in clean) {
        clean[field] = '[REDACTED]';
      }
    }

    return clean;
  }

  /* =====================================================
     STATE_ADMIN ANALYTICS
  ===================================================== */

  /**
   * Admin: Get resource history
   */
  static async getResourceTrail(
    resourceType: string,
    resourceId: string
  ) {
    return AuditRepository.getResourceHistory(resourceType, resourceId);
  }

  /**
   * Admin: Get user activity
   */
  static async getUserActivity(userId: string, limit: number = 50) {
    return AuditRepository.getUserActions(userId, limit);
  }
}