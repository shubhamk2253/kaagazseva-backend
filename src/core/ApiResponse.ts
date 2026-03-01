import { Response } from 'express';
import type { PaginationMeta } from './types';

/**
 * KAAGAZSEVA - Global API Response Wrapper
 * Enforces predictable, standardized JSON responses.
 */
export class ApiResponse {

  /**
   * Standard success response
   */
  static success<T>(
    res: Response,
    message: string,
    data: T | null = null,
    statusCode: number = 200
  ) {
    return res.status(statusCode).json({
      success: true,
      message,
      data: data ?? null,
    });
  }

  /**
   * Paginated success response
   * Used for list endpoints (Applications, Users, Tickets, etc.)
   */
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
      data: items,
      meta,
    });
  }

  /**
   * Created response (201)
   */
  static created<T>(
    res: Response,
    message: string,
    data: T | null = null
  ) {
    return res.status(201).json({
      success: true,
      message,
      data: data ?? null,
    });
  }

  /**
   * No Content response (204)
   */
  static noContent(res: Response) {
    return res.status(204).send();
  }
}