import { Response } from 'express';

/**
 * KAAGAZSEVA - Global API Response Wrapper
 * Enforces predictable, standardized JSON responses.
 * Every response — success or error — has the same envelope.
 */

/* =====================================================
   PAGINATION META TYPE
===================================================== */

export interface PaginationMeta {
  page:       number;
  limit:      number;
  total:      number;
  totalPages: number;
  hasNext:    boolean;
  hasPrev:    boolean;
}

/* =====================================================
   HELPER — build pagination meta from raw numbers
===================================================== */

export function buildPaginationMeta(
  page: number,
  limit: number,
  total: number
): PaginationMeta {
  const totalPages = Math.ceil(total / limit);
  return {
    page,
    limit,
    total,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1,
  };
}

/* =====================================================
   API RESPONSE CLASS
===================================================== */

export class ApiResponse {

  //////////////////////////////////////////////////////
  // SUCCESS — 200
  //////////////////////////////////////////////////////

  static success<T>(
    res: Response,
    message: string,
    data: T | null = null,
    statusCode: number = 200,
    meta?: Record<string, any>
  ) {
    return res.status(statusCode).json({
      success:   true,
      message,
      timestamp: new Date().toISOString(),
      data:      data ?? null,
      ...(meta && { meta }),
    });
  }

  //////////////////////////////////////////////////////
  // CREATED — 201
  //////////////////////////////////////////////////////

  static created<T>(
    res: Response,
    message: string,
    data: T | null = null
  ) {
    return res.status(201).json({
      success:   true,
      message,
      timestamp: new Date().toISOString(),
      data:      data ?? null,
    });
  }

  //////////////////////////////////////////////////////
  // PAGINATED — 200
  //////////////////////////////////////////////////////

  static paginated<T>(
    res: Response,
    message: string,
    items: T[],
    meta: PaginationMeta,
    statusCode: number = 200
  ) {
    return res.status(statusCode).json({
      success:   true,
      message,
      timestamp: new Date().toISOString(),
      data:      items,
      meta,
    });
  }

  //////////////////////////////////////////////////////
  // NO CONTENT — 204
  //////////////////////////////////////////////////////

  static noContent(res: Response) {
    return res.status(204).send();
  }

  //////////////////////////////////////////////////////
  // ERROR RESPONSES
  // Used in routes and controllers directly
  // (error middleware handles AppError automatically)
  //////////////////////////////////////////////////////

  static badRequest(
    res: Response,
    message: string = 'Bad request',
    errorCode?: string,
    errors?: object
  ) {
    return res.status(400).json({
      success:   false,
      message,
      timestamp: new Date().toISOString(),
      ...(errorCode && { errorCode }),
      ...(errors   && { errors }),
    });
  }

  static unauthorized(
    res: Response,
    message: string = 'Unauthorized'
  ) {
    return res.status(401).json({
      success:   false,
      message,
      timestamp: new Date().toISOString(),
      errorCode: 'UNAUTHORIZED',
    });
  }

  static forbidden(
    res: Response,
    message: string = 'Access denied'
  ) {
    return res.status(403).json({
      success:   false,
      message,
      timestamp: new Date().toISOString(),
      errorCode: 'FORBIDDEN',
    });
  }

  static notFound(
    res: Response,
    message: string = 'Resource not found'
  ) {
    return res.status(404).json({
      success:   false,
      message,
      timestamp: new Date().toISOString(),
      errorCode: 'NOT_FOUND',
    });
  }

  static conflict(
    res: Response,
    message: string,
    errorCode?: string
  ) {
    return res.status(409).json({
      success:   false,
      message,
      timestamp: new Date().toISOString(),
      ...(errorCode && { errorCode }),
    });
  }

  static tooManyRequests(
    res: Response,
    message: string = 'Too many requests'
  ) {
    return res.status(429).json({
      success:   false,
      message,
      timestamp: new Date().toISOString(),
      errorCode: 'RATE_LIMITED',
    });
  }

  static internal(
    res: Response,
    message: string = 'Something went wrong. Please contact support.'
  ) {
    return res.status(500).json({
      success:   false,
      message,
      timestamp: new Date().toISOString(),
      errorCode: 'INTERNAL_ERROR',
    });
  }

  static serviceUnavailable(
    res: Response,
    message: string = 'Service temporarily unavailable'
  ) {
    return res.status(503).json({
      success:   false,
      message,
      timestamp: new Date().toISOString(),
      errorCode: 'SERVICE_UNAVAILABLE',
    });
  }
}