import { Response } from 'express';
import type { PaginationMeta } from './types';

/**
 * KAAGAZSEVA - Global API Response Wrapper
 * Enforces predictable, standardized JSON responses.
 */
export class ApiResponse {

  //////////////////////////////////////////////////////
  // STANDARD SUCCESS
  //////////////////////////////////////////////////////

  static success<T>(
    res: Response,
    message: string,
    data: T | null = null,
    statusCode: number = 200,
    meta?: Record<string, any>
  ) {

    return res.status(statusCode).json({
      success: true,
      message,
      timestamp: new Date().toISOString(),
      data: data ?? null,
      ...(meta && { meta }),
    });

  }

  //////////////////////////////////////////////////////
  // PAGINATED RESPONSE
  //////////////////////////////////////////////////////

  static paginated<T>(
    res: Response,
    message: string,
    items: T[],
    meta: PaginationMeta,
    statusCode: number = 200
  ) {

    return res.status(statusCode).json({
      success: true,
      message,
      timestamp: new Date().toISOString(),
      data: items,
      meta,
    });

  }

  //////////////////////////////////////////////////////
  // CREATED
  //////////////////////////////////////////////////////

  static created<T>(
    res: Response,
    message: string,
    data: T | null = null
  ) {

    return res.status(201).json({
      success: true,
      message,
      timestamp: new Date().toISOString(),
      data: data ?? null,
    });

  }

  //////////////////////////////////////////////////////
  // NO CONTENT
  //////////////////////////////////////////////////////

  static noContent(res: Response) {
    return res.status(204).send();
  }

}