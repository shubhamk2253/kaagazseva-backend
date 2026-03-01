/**
 * KAAGAZSEVA - Global Application Error Class
 * Standardized operational error for predictable backend handling.
 */

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly errorCode?: string;

  constructor(
    message: string,
    statusCode: number = 500,
    isOperational: boolean = true,
    errorCode?: string
  ) {
    super(message);

    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.errorCode = errorCode;

    // Maintain proper prototype chain (important for instanceof checks)
    Object.setPrototypeOf(this, new.target.prototype);

    // Capture stack trace (cleaner logs)
    Error.captureStackTrace(this);
  }
}