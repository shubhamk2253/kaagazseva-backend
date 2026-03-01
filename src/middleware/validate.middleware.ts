import { Response, NextFunction, RequestHandler } from 'express';
import { ZodSchema, ZodError, AnyZodObject } from 'zod';
import { RequestWithUser } from '../core/types';
import { AppError } from '../core/AppError';
import { env } from '../config/env';

/**
 * KAAGAZSEVA - Universal Zod Validation Middleware
 * Supports:
 * 1️⃣ Full schema object (recommended)
 * 2️⃣ body/query/params separated schema
 */

type SchemaType =
  | AnyZodObject
  | {
      body?: ZodSchema<any>;
      query?: ZodSchema<any>;
      params?: ZodSchema<any>;
    };

export const validate = (schema: SchemaType): RequestHandler => {
  return (req: RequestWithUser, _res: Response, next: NextFunction) => {
    try {
      // ------------------------------------------
      // 1️⃣ If full Zod object passed
      // ------------------------------------------
      if ('parse' in schema) {
        const parsed = schema.parse({
          body: req.body,
          query: req.query,
          params: req.params,
        });

        if (parsed.body) req.body = parsed.body;
        if (parsed.query) req.query = parsed.query;
        if (parsed.params) req.params = parsed.params;

        return next();
      }

      // ------------------------------------------
      // 2️⃣ If body/query/params schema passed
      // ------------------------------------------
      if (schema.body) {
        req.body = schema.body.parse(req.body);
      }

      if (schema.query) {
        req.query = schema.query.parse(req.query);
      }

      if (schema.params) {
        req.params = schema.params.parse(req.params);
      }

      return next();
    } catch (error) {
      if (error instanceof ZodError) {
        const formattedErrors = error.errors.map((err) => ({
          field: err.path.join('.'),
          message: err.message,
        }));

        if (env.NODE_ENV === 'development') {
          return next(
            new AppError(
              `Validation Failed: ${formattedErrors
                .map((e) => `${e.field}: ${e.message}`)
                .join(', ')}`,
              400
            )
          );
        }

        return next(
          new AppError(
            formattedErrors[0]?.message || 'Invalid request data',
            400
          )
        );
      }

      return next(error);
    }
  };
};