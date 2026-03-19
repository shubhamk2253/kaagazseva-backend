import { Response, NextFunction } from 'express';
import { prisma }                 from '../config/database';
import { RequestWithUser }        from '../core/types';
import logger                     from '../core/logger';
import { AuditAction, Prisma }    from '@prisma/client';

/**
 * KAAGAZSEVA - Audit Middleware
 * Logs all state-changing operations for compliance.
 * Fire-and-forget — never blocks API response.
 */

/* =====================================================
   SENSITIVE FIELDS — redacted before logging
===================================================== */

const SENSITIVE_FIELDS = [
  'password', 'confirmpassword', 'currentpassword', 'newpassword',
  'aadhaar', 'pan', 'bankaccountnumber', 'bankifsc', 'cvv',
  'token', 'refreshtoken', 'accesstoken', 'otp', 'pin', 'secret',
];

/* =====================================================
   HELPERS
===================================================== */

function sanitizeBody(body: any): any {
  if (!body || typeof body !== 'object') return body;

  return Object.keys(body).reduce((acc, key) => {
    if (SENSITIVE_FIELDS.includes(key.toLowerCase())) {
      acc[key] = '[REDACTED]';
    } else if (typeof body[key] === 'object' && body[key] !== null) {
      acc[key] = sanitizeBody(body[key]);
    } else {
      acc[key] = body[key];
    }
    return acc;
  }, {} as any);
}

function truncateBody(body: any): any {
  if (!body) return null;
  const str = JSON.stringify(body);
  if (str.length > 5000) {
    return { _truncated: true, _originalSize: str.length };
  }
  return body;
}

function mapMethodToAction(method: string): AuditAction {
  switch (method) {
    case 'POST':   return AuditAction.CREATE;
    case 'PUT':
    case 'PATCH':  return AuditAction.UPDATE;
    case 'DELETE': return AuditAction.DELETE;
    default:       return AuditAction.ACCESS;
  }
}

function extractResourceType(url: string): string {
  const parts = url.split('?')[0].split('/').filter(Boolean);
  return parts[2]?.toUpperCase() || 'UNKNOWN';
}

function extractResourceId(url: string): string | null {
  const parts = url.split('?')[0].split('/').filter(Boolean);
  const candidate = parts[3];

  if (!candidate) return null;

  const uuidPattern    = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const numericPattern = /^\d+$/;

  if (uuidPattern.test(candidate) || numericPattern.test(candidate)) {
    return candidate;
  }

  return null; // 'login', 'register', 'refresh' are not IDs
}

/* =====================================================
   MIDDLEWARE
===================================================== */

export const auditMiddleware = (
  req: RequestWithUser,
  res: Response,
  next: NextFunction
) => {
  const trackedMethods = ['POST', 'PUT', 'PATCH', 'DELETE'];

  if (!trackedMethods.includes(req.method)) {
    return next();
  }

  const originalJson = res.json.bind(res);

  res.json = (body: any) => {

    // Only audit successful mutations
    if (res.statusCode >= 200 && res.statusCode < 300) {

      const sanitized  = sanitizeBody(req.body);
      const truncated  = truncateBody(sanitized);

      // Fire and forget — never awaited
      prisma.auditLog
        .create({
          data: {
            userId:       req.user?.userId ?? null,
            action:       mapMethodToAction(req.method),
            resourceType: extractResourceType(req.originalUrl),
            resourceId:   extractResourceId(req.originalUrl),
            method:       req.method,
            path:         req.path,             // clean path, no query string
            oldData:      Prisma.JsonNull,
            newData:      truncated
                            ? (truncated as Prisma.InputJsonValue)
                            : Prisma.JsonNull,
            ip:           req.ip ?? null,
            userAgent:    req.headers['user-agent'] ?? null,
            requestId:    req.requestId ?? null,
            statusCode:   res.statusCode,
            success:      true,
          },
        })
        .catch((err) => {
          logger.error({
            event:     'AUDIT_LOG_FAILED',
            requestId: req.requestId,
            error:     err.message,
          });
        });
    }

    return originalJson(body);
  };

  next();
};