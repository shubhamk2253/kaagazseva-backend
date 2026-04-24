import { AuditRepository }  from './audit.repository';
import logger               from '../../core/logger';
import { AuditAction }      from '@prisma/client';

/**
 * KAAGAZSEVA - Audit Service
 * Enterprise-grade black box recorder.
 * Never throws — audit failure must not break system flow.
 */

/* =====================================================
   RESOURCE TYPE CONSTANTS
===================================================== */

export const AuditResourceTypes = {
  APPLICATION:     'Application',
  USER:            'User',
  PAYMENT:         'Payment',
  WALLET:          'Wallet',
  TICKET:          'Ticket',
  SUSPENSION_CASE: 'SuspensionCase',
  REFUND:          'Refund',
  AGENT:           'Agent',
  SYSTEM:          'System',
} as const;

export type AuditResourceType =
  typeof AuditResourceTypes[keyof typeof AuditResourceTypes];

/* =====================================================
   SENSITIVE FIELDS — redacted before logging
===================================================== */

const SENSITIVE_FIELDS = [
  'password', 'confirmpassword', 'currentpassword', 'newpassword',
  'otp', 'pin', 'token', 'refreshtoken', 'accesstoken',
  'secret', 'cvv', 'cardnumber', 'aadhaar', 'pan',
];

/* =====================================================
   SERVICE
===================================================== */

export class AuditService {

  /* =====================================================
     RECORD — main entry point
     Safe: never throws, never breaks caller
  ===================================================== */

  static async record(params: {
    userId?:      string;
    action:       AuditAction;
    resourceType: string;
    resourceId?:  string;
    method?:      string;
    path?:        string;
    oldData?:     Record<string, unknown> | null;
    newData?:     Record<string, unknown> | null;
    statusCode?:  number;
    success?:     boolean;
    ip?:          string;
    userAgent?:   string;
    requestId?:   string;
  }) {
    try {
      await AuditRepository.log({
        userId:       params.userId,
        action:       params.action,
        resourceType: params.resourceType,
        resourceId:   params.resourceId,
        method:       params.method,
        path:         params.path,
        oldData:      this.sanitize(params.oldData),
        newData:      this.sanitize(params.newData),
        statusCode:   params.statusCode,
        success:      params.success ?? true,
        ip:           params.ip,
        userAgent:    params.userAgent,
        requestId:    params.requestId,
      });
    } catch (error: any) {
      // NEVER rethrow — audit must not break main flow
      logger.error({
        event:     'AUDIT_LOG_FAILURE',
        error:     error.message,
        action:    params.action,
        resource:  params.resourceType,
        requestId: params.requestId,
      });
    }
  }

  /* =====================================================
     SANITIZE — recursive sensitive field removal
  ===================================================== */

  private static sanitize(
    payload: Record<string, unknown> | null | undefined
  ): Record<string, unknown> | null {

    if (!payload || typeof payload !== 'object') return null;

    return Object.keys(payload).reduce((acc, key) => {
      if (SENSITIVE_FIELDS.includes(key.toLowerCase())) {
        acc[key] = '[REDACTED]';
      } else if (
        typeof payload[key] === 'object' &&
        payload[key] !== null &&
        !Array.isArray(payload[key])
      ) {
        acc[key] = this.sanitize(
          payload[key] as Record<string, unknown>
        );
      } else {
        acc[key] = payload[key];
      }
      return acc;
    }, {} as Record<string, unknown>);
  }

  /* =====================================================
     QUERIES — expose repository methods
  ===================================================== */

  static async getResourceTrail(
    resourceType: string,
    resourceId:   string
  ) {
    return AuditRepository.getResourceHistory(resourceType, resourceId);
  }

  static async getUserActivity(
    userId: string,
    limit:  number = 50
  ) {
    return AuditRepository.getUserActions(userId, limit);
  }

  static async getSecurityEvents(limit: number = 100) {
    return AuditRepository.getSecurityEvents(limit);
  }

  static async getHighRiskEvents(limit: number = 50) {
    return AuditRepository.getHighRiskEvents(limit);
  }

  static async getRecentLogins(limit: number = 50) {
    return AuditRepository.getRecentLogins(limit);
  }
}