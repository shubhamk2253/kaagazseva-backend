import { Response, NextFunction } from 'express';
import { prisma } from '../config/database';
import { RequestWithUser } from '../core/types';
import logger from '../core/logger';
import { AuditAction, Prisma } from '@prisma/client';

/**
 * KAAGAZSEVA - Enterprise Audit Middleware
 * Logs all state-changing operations for compliance & forensic tracking.
 */

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
    if (res.statusCode >= 200 && res.statusCode < 300) {
      try {
        prisma.auditLog
          .create({
            data: {
              userId: req.user?.userId ?? null,

              // 🔹 Map HTTP method → AuditAction
              action: mapMethodToAction(req.method),

              resourceType: extractResourceType(req.originalUrl),
              resourceId: extractResourceId(req.originalUrl),

              method: req.method,
              path: req.originalUrl,

              // ✅ Prisma 7 JSON-safe values
              oldData: Prisma.JsonNull,
              newData: req.body
                ? (req.body as Prisma.InputJsonValue)
                : Prisma.JsonNull,

              ip: req.ip ?? null,
              userAgent: req.headers['user-agent'] ?? null,
              requestId: req.requestId ?? null,

              statusCode: res.statusCode,
              success: true,
            },
          })
          .catch((err) => {
            logger.error(
              `Audit Logging Failed | requestId=${req.requestId}`,
              err
            );
          });
      } catch (err) {
        logger.error(
          `Audit Serialization Failed | requestId=${req.requestId}`,
          err
        );
      }
    }

    return originalJson(body);
  };

  next();
};

/* =====================================================
   Helpers
===================================================== */

function mapMethodToAction(method: string): AuditAction {
  switch (method) {
    case 'POST':
      return AuditAction.CREATE;
    case 'PUT':
    case 'PATCH':
      return AuditAction.UPDATE;
    case 'DELETE':
      return AuditAction.DELETE;
    default:
      return AuditAction.ACCESS;
  }
}

function extractResourceType(url: string): string {
  // Example: /api/v1/applications/123 → APPLICATION
  const parts = url.split('/').filter(Boolean);
  return parts[2]?.toUpperCase() || 'UNKNOWN';
}

function extractResourceId(url: string): string | null {
  const parts = url.split('/').filter(Boolean);
  return parts[3] || null;
}