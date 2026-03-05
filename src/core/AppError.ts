/**
 * KAAGAZSEVA - Global Application Error Class
 * Standardized operational error for predictable backend handling.
 */

export class AppError extends Error {

  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly errorCode?: string;
  public readonly details?: any;
  public readonly timestamp: string;

  constructor(
    message: string,
    statusCode: number = 500,
    isOperational: boolean = true,
    errorCode?: string,
    details?: any
  ) {

    super(message);

    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.errorCode = errorCode;
    this.details = details;
    this.timestamp = new Date().toISOString();

    // Maintain proper prototype chain
    Object.setPrototypeOf(this, new.target.prototype);

    // Capture stack trace
    Error.captureStackTrace(this);

  }

  //////////////////////////////////////////////////////
  // SERIALIZE ERROR
  //////////////////////////////////////////////////////

  serialize() {

    return {
      success: false,
      message: this.message,
      errorCode: this.errorCode,
      details: this.details,
      timestamp: this.timestamp,
    };

  }

}