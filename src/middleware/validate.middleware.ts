import { Response, NextFunction, RequestHandler } from 'express';
import { ZodSchema, ZodError, AnyZodObject }      from 'zod';
import { RequestWithUser }                         from '../core/types';
import logger                                      from '../core/logger';

/**
 * KAAGAZSEVA - Universal Zod Validation Middleware
 * Validates body, query, and params against Zod schemas.
 * Zod errors forwarded to errorMiddleware for consistent formatting.
 */

type SchemaType =
  | AnyZodObject
  | {
      body?:   ZodSchema<any>;
      query?:  ZodSchema<any>;
      params?: ZodSchema<any>;
    };

export const validate = (schema: SchemaType): RequestHandler => {

  return (req: RequestWithUser, _res: Response, next: NextFunction) => {

    try {

      /* =====================================================
         MODE 1 — FULL SCHEMA
         Single Zod object covering body + query + params
      ===================================================== */

      if ('safeParse' in schema) {

        const result = schema.safeParse({
          body:   req.body,
          query:  req.query,
          params: req.params,
        });

        if (!result.success) {
          // Log then forward to errorMiddleware
          logValidationFailure(req, result.error);
          return next(result.error);
        }

        // Replace with sanitized + coerced data
        const parsed = result.data;
        if (parsed.body)   req.body   = parsed.body;
        if (parsed.query)  req.query  = parsed.query;
        if (parsed.params) req.params = parsed.params;

        return next();
      }

      /* =====================================================
         MODE 2 — PARTIAL SCHEMA
         Validate body, query, params independently
      ===================================================== */

      if (schema.body) {
        const result = schema.body.safeParse(req.body);
        if (!result.success) {
          logValidationFailure(req, result.error);
          return next(result.error);
        }
        req.body = result.data;
      }

      if (schema.query) {
        const result = schema.query.safeParse(req.query);
        if (!result.success) {
          logValidationFailure(req, result.error);
          return next(result.error);
        }
        req.query = result.data;
      }

      if (schema.params) {
        const result = schema.params.safeParse(req.params);
        if (!result.success) {
          logValidationFailure(req, result.error);
          return next(result.error);
        }
        req.params = result.data;
      }

      return next();

    } catch (error) {
      return next(error);
    }
  };
};

/* =====================================================
   HELPER — structured validation failure log
===================================================== */

function logValidationFailure(
  req:   RequestWithUser,
  error: ZodError
): void {
  logger.warn({
    event:     'VALIDATION_FAILED',
    path:      req.originalUrl,
    method:    req.method,
    requestId: req.requestId,
    errors:    error.issues.map(issue => ({
      field:   issue.path.join('.'),
      message: issue.message,
      code:    issue.code,
    })),
  });
}