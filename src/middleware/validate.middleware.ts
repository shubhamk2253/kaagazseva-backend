import { Response, NextFunction, RequestHandler } from 'express';
import { ZodSchema, ZodError, AnyZodObject } from 'zod';
import { RequestWithUser } from '../core/types';
import { AppError } from '../core/AppError';
import { env } from '../config/env';
import logger from '../core/logger';

/**
 * KAAGAZSEVA - Universal Zod Validation Middleware
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

      ////////////////////////////////////////////////////
      // 1️⃣ FULL SCHEMA VALIDATION
      ////////////////////////////////////////////////////

      if ('safeParse' in schema) {

        const result = schema.safeParse({
          body: req.body,
          query: req.query,
          params: req.params,
        });

        if (!result.success) {

          throw result.error;

        }

        const parsed = result.data;

        if (parsed.body) req.body = parsed.body;
        if (parsed.query) req.query = parsed.query;
        if (parsed.params) req.params = parsed.params;

        return next();

      }

      ////////////////////////////////////////////////////
      // 2️⃣ PARTIAL VALIDATION
      ////////////////////////////////////////////////////

      if (schema.body) {

        const result = schema.body.safeParse(req.body);

        if (!result.success) {
          throw result.error;
        }

        req.body = result.data;

      }

      if (schema.query) {

        const result = schema.query.safeParse(req.query);

        if (!result.success) {
          throw result.error;
        }

        req.query = result.data;

      }

      if (schema.params) {

        const result = schema.params.safeParse(req.params);

        if (!result.success) {
          throw result.error;
        }

        req.params = result.data;

      }

      return next();

    } catch (error) {

      ////////////////////////////////////////////////////
      // ZOD ERROR HANDLING
      ////////////////////////////////////////////////////

      if (error instanceof ZodError) {

        const formattedErrors = error.errors.map((err) => ({
          field: err.path.join('.'),
          message: err.message,
        }));

        logger.warn({
          event: 'VALIDATION_FAILED',
          path: req.originalUrl,
          errors: formattedErrors,
          requestId: req.requestId,
        });

        if (env.NODE_ENV === 'development') {

          return next(
            new AppError(
              formattedErrors
                .map((e) => `${e.field}: ${e.message}`)
                .join(', '),
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