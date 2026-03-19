/**
 * KAAGAZSEVA - Global Application Error Class
 * Standardized operational error for predictable backend handling.
 *
 * Usage:
 *   throw new AppError('Not found', 404);
 *   throw AppError.notFound('User not found');
 *   throw AppError.forbidden('Access denied', ErrorCodes.USER_SUSPENDED);
 */

/* =====================================================
   ERROR CODES
   Centralized — use these everywhere instead of strings
===================================================== */

export const ErrorCodes = {

  // Auth
  INVALID_CREDENTIALS:     'INVALID_CREDENTIALS',
  TOKEN_EXPIRED:           'TOKEN_EXPIRED',
  TOKEN_INVALID:           'TOKEN_INVALID',
  UNAUTHORIZED:            'UNAUTHORIZED',
  FORBIDDEN:               'FORBIDDEN',
  SESSION_EXPIRED:         'SESSION_EXPIRED',

  // User
  USER_NOT_FOUND:          'USER_NOT_FOUND',
  USER_SUSPENDED:          'USER_SUSPENDED',
  USER_INACTIVE:           'USER_INACTIVE',
  DUPLICATE_PHONE:         'DUPLICATE_PHONE',
  DUPLICATE_EMAIL:         'DUPLICATE_EMAIL',

  // Agent
  AGENT_NOT_FOUND:         'AGENT_NOT_FOUND',
  AGENT_UNAVAILABLE:       'AGENT_UNAVAILABLE',
  AGENT_MAX_CASES:         'AGENT_MAX_CASES',
  AGENT_NOT_VERIFIED:      'AGENT_NOT_VERIFIED',
  AGENT_SUSPENDED:         'AGENT_SUSPENDED',
  AGENT_NOT_AVAILABLE:     'AGENT_NOT_AVAILABLE',

  // Application
  APPLICATION_NOT_FOUND:   'APPLICATION_NOT_FOUND',
  INVALID_STATUS_CHANGE:   'INVALID_STATUS_CHANGE',
  APPLICATION_EXPIRED:     'APPLICATION_EXPIRED',
  APPLICATION_ALREADY_PAID:'APPLICATION_ALREADY_PAID',
  OUTSIDE_SERVICE_RADIUS:  'OUTSIDE_SERVICE_RADIUS',
  NO_AGENTS_AVAILABLE:     'NO_AGENTS_AVAILABLE',

  // Service
  SERVICE_NOT_FOUND:       'SERVICE_NOT_FOUND',
  SERVICE_UNAVAILABLE:     'SERVICE_UNAVAILABLE',
  SERVICE_MODE_INVALID:    'SERVICE_MODE_INVALID',

  // Geography
  INVALID_PINCODE:         'INVALID_PINCODE',
  INVALID_STATE:           'INVALID_STATE',
  INVALID_DISTRICT:        'INVALID_DISTRICT',

  // Payment
  PAYMENT_FAILED:          'PAYMENT_FAILED',
  PAYMENT_ALREADY_DONE:    'PAYMENT_ALREADY_DONE',
  PAYMENT_VERIFICATION_FAILED: 'PAYMENT_VERIFICATION_FAILED',
  INVALID_WEBHOOK:         'INVALID_WEBHOOK',
  PAYMENTS_FROZEN:         'PAYMENTS_FROZEN',

  // Wallet
  INSUFFICIENT_BALANCE:    'INSUFFICIENT_BALANCE',
  WALLET_FROZEN:           'WALLET_FROZEN',
  WITHDRAWAL_LIMIT:        'WITHDRAWAL_LIMIT',
  WITHDRAWALS_FROZEN:      'WITHDRAWALS_FROZEN',

  // Refund
  REFUND_NOT_ELIGIBLE:     'REFUND_NOT_ELIGIBLE',
  REFUND_ALREADY_REQUESTED:'REFUND_ALREADY_REQUESTED',
  REFUNDS_FROZEN:          'REFUNDS_FROZEN',

  // Documents
  DOCUMENT_NOT_FOUND:      'DOCUMENT_NOT_FOUND',
  DOCUMENT_UPLOAD_FAILED:  'DOCUMENT_UPLOAD_FAILED',
  INVALID_FILE_TYPE:       'INVALID_FILE_TYPE',
  FILE_TOO_LARGE:          'FILE_TOO_LARGE',

  // System
  RATE_LIMITED:            'RATE_LIMITED',
  ASSIGNMENTS_PAUSED:      'ASSIGNMENTS_PAUSED',
  MAINTENANCE_MODE:        'MAINTENANCE_MODE',
  INTERNAL_ERROR:          'INTERNAL_ERROR',
  SERVICE_FROZEN:          'SERVICE_FROZEN',
  VALIDATION_ERROR:        'VALIDATION_ERROR',

} as const;

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];

/* =====================================================
   APP ERROR CLASS
===================================================== */

export class AppError extends Error {

  public readonly statusCode:    number;
  public readonly isOperational: boolean;
  public readonly errorCode?:    string;
  public readonly details?:      any;
  public readonly timestamp:     string;

  constructor(
    message: string,
    statusCode:    number  = 500,
    isOperational: boolean = true,
    errorCode?:    string,
    details?:      any
  ) {

    super(message);

    this.statusCode    = statusCode;
    this.isOperational = isOperational;
    this.errorCode     = errorCode;
    this.details       = details;
    this.timestamp     = new Date().toISOString();

    // Maintain proper prototype chain
    // Without this, instanceof AppError returns false in TypeScript
    Object.setPrototypeOf(this, new.target.prototype);

    // Capture stack trace — removes AppError constructor
    // from the stack for cleaner error traces
    Error.captureStackTrace(this, this.constructor);

  }

  //////////////////////////////////////////////////////
  // SERIALIZE
  // Used to send error as JSON response
  //////////////////////////////////////////////////////

  serialize(includeDetails: boolean = false) {
    return {
      success:   false,
      message:   this.message,
      errorCode: this.errorCode,
      timestamp: this.timestamp,
      ...(includeDetails && this.details ? { details: this.details } : {}),
    };
  }

  //////////////////////////////////////////////////////
  // STATIC FACTORIES
  // Cleaner throw syntax across the codebase
  //
  // Instead of:
  //   throw new AppError('Not found', 404, true, 'NOT_FOUND')
  // Use:
  //   throw AppError.notFound('User not found')
  //////////////////////////////////////////////////////

  static badRequest(
    message: string,
    errorCode: string = ErrorCodes.VALIDATION_ERROR,
    details?: any
  ) {
    return new AppError(message, 400, true, errorCode, details);
  }

  static unauthorized(
    message: string = 'Unauthorized access',
    errorCode: string = ErrorCodes.UNAUTHORIZED
  ) {
    return new AppError(message, 401, true, errorCode);
  }

  static forbidden(
    message: string = 'Access denied',
    errorCode: string = ErrorCodes.FORBIDDEN
  ) {
    return new AppError(message, 403, true, errorCode);
  }

  static notFound(
    message: string = 'Resource not found',
    errorCode: string = ErrorCodes.INTERNAL_ERROR
  ) {
    return new AppError(message, 404, true, errorCode);
  }

  static conflict(
    message: string,
    errorCode: string = ErrorCodes.DUPLICATE_EMAIL
  ) {
    return new AppError(message, 409, true, errorCode);
  }

  static tooManyRequests(
    message: string = 'Too many requests. Please slow down.',
    errorCode: string = ErrorCodes.RATE_LIMITED
  ) {
    return new AppError(message, 429, true, errorCode);
  }

  static internal(
    message: string = 'Internal server error',
  ) {
    // isOperational = false — hides real message in production
    return new AppError(message, 500, false, ErrorCodes.INTERNAL_ERROR);
  }

  static serviceUnavailable(
    message: string = 'Service temporarily unavailable',
    errorCode: string = ErrorCodes.SERVICE_FROZEN
  ) {
    return new AppError(message, 503, true, errorCode);
  }

  // ── KaagazSeva Specific Factories ────────────────

  static paymentsFrozen() {
    return new AppError(
      'Payments are temporarily frozen. Please try again later.',
      503, true, ErrorCodes.PAYMENTS_FROZEN
    );
  }

  static withdrawalsFrozen() {
    return new AppError(
      'Withdrawals are temporarily frozen. Please try again later.',
      503, true, ErrorCodes.WITHDRAWALS_FROZEN
    );
  }

  static refundsFrozen() {
    return new AppError(
      'Refunds are temporarily frozen. Please contact support.',
      503, true, ErrorCodes.REFUNDS_FROZEN
    );
  }

  static maintenanceMode() {
    return new AppError(
      'KaagazSeva is under maintenance. Please try again shortly.',
      503, true, ErrorCodes.MAINTENANCE_MODE
    );
  }

  static assignmentsPaused() {
    return new AppError(
      'Agent assignments are temporarily paused.',
      503, true, ErrorCodes.ASSIGNMENTS_PAUSED
    );
  }

  static agentMaxCases() {
    return new AppError(
      'Agent has reached maximum active case limit.',
      409, true, ErrorCodes.AGENT_MAX_CASES
    );
  }

  static outsideServiceRadius() {
    return new AppError(
      'No agents available within your service area.',
      400, true, ErrorCodes.OUTSIDE_SERVICE_RADIUS
    );
  }

  static invalidStatusTransition(from: string, to: string) {
    return new AppError(
      `Cannot transition application from ${from} to ${to}.`,
      400, true, ErrorCodes.INVALID_STATUS_CHANGE
    );
  }

  static insufficientBalance(available: number, required: number) {
    return new AppError(
      `Insufficient balance. Available: ₹${available}, Required: ₹${required}.`,
      400, true, ErrorCodes.INSUFFICIENT_BALANCE
    );
  }

  static userSuspended(reason?: string) {
    return new AppError(
      reason
        ? `Account suspended: ${reason}`
        : 'Your account has been suspended. Please contact support.',
      403, true, ErrorCodes.USER_SUSPENDED
    );
  }

}