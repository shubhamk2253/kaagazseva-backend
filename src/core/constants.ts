/**
 * KAAGAZSEVA - Global Constants
 * National-Level GovTech Infrastructure Standardization
 */

/* =========================================================
   USER ROLES
========================================================= */

export enum UserRole {
  STATE_ADMIN = 'STATE_ADMIN',
  AGENT = 'AGENT',
  CUSTOMER = 'CUSTOMER',
}

/* =========================================================
   APPLICATION STATUS FLOW
========================================================= */

export enum ApplicationStatus {
  DRAFT = 'DRAFT',
  PENDING_PAYMENT = 'PENDING_PAYMENT',
  SUBMITTED = 'SUBMITTED',
  UNDER_REVIEW = 'UNDER_REVIEW',
  DOCUMENT_REQUIRED = 'DOCUMENT_REQUIRED',
  APPROVED = 'APPROVED',
  COMPLETED = 'COMPLETED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED',
}

/* =========================================================
   WALLET
========================================================= */

export enum TransactionType {
  COMMISSION = 'COMMISSION',
  WITHDRAWAL = 'WITHDRAWAL',
  REFUND = 'REFUND',
  ADJUSTMENT = 'ADJUSTMENT',
}

export enum TransactionStatus {
  PENDING = 'PENDING',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
  REVERSED = 'REVERSED',
}

/* =========================================================
   SUPPORT TICKETS
========================================================= */

export enum TicketStatus {
  OPEN = 'OPEN',
  IN_PROGRESS = 'IN_PROGRESS',
  RESOLVED = 'RESOLVED',
  CLOSED = 'CLOSED',
  ESCALATED = 'ESCALATED',
}

/* =========================================================
   AUDIT EVENTS (For Compliance Logging)
========================================================= */

export enum AuditEvent {
  USER_LOGIN = 'USER_LOGIN',
  USER_LOGOUT = 'USER_LOGOUT',
  APPLICATION_CREATED = 'APPLICATION_CREATED',
  APPLICATION_STATUS_CHANGED = 'APPLICATION_STATUS_CHANGED',
  WALLET_WITHDRAWAL_REQUESTED = 'WALLET_WITHDRAWAL_REQUESTED',
  WALLET_WITHDRAWAL_APPROVED = 'WALLET_WITHDRAWAL_APPROVED',
  STATE_ADMIN_ACTION = 'STATE_ADMIN_ACTION',
}

/* =========================================================
   SYSTEM LIMITS
========================================================= */

export const SYSTEM_LIMITS = {
  MAX_FILE_SIZE_MB: 5,
  MAX_FILES_PER_APPLICATION: 10,
  OTP_EXPIRY_SECONDS: 300,
  MAX_OTP_ATTEMPTS: 3,
  ACCESS_TOKEN_EXPIRY_MINUTES: 15,
  REFRESH_TOKEN_EXPIRY_DAYS: 7,
  MAX_WITHDRAWALS_PER_DAY: 3,
};

/* =========================================================
   PAGINATION DEFAULTS
========================================================= */

export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
};

/* =========================================================
   RATE LIMIT TIERS
========================================================= */

export const RATE_LIMITS = {
  GLOBAL: {
    WINDOW_MS: 15 * 60 * 1000,
    MAX: 300,
  },
  AUTH: {
    WINDOW_MS: 60 * 60 * 1000,
    MAX: 5,
  },
  CRITICAL: {
    WINDOW_MS: 10 * 60 * 1000,
    MAX: 20,
  },
};

/* =========================================================
   STANDARD RESPONSE MESSAGES
========================================================= */

export const MESSAGES = {
  AUTH: {
    OTP_SENT: 'OTP sent successfully.',
    INVALID_OTP: 'Invalid or expired OTP.',
    TOKEN_REFRESHED: 'Session refreshed successfully.',
    LOGOUT: 'Logged out successfully.',
  },

  APPLICATION: {
    CREATED: 'Application submitted successfully.',
    UPDATED: 'Application updated successfully.',
    STATUS_CHANGED: 'Application status updated.',
  },

  WALLET: {
    WITHDRAWAL_REQUESTED: 'Withdrawal request submitted.',
    WITHDRAWAL_APPROVED: 'Withdrawal approved successfully.',
  },

  GENERIC: {
    SUCCESS: 'Request processed successfully.',
    ERROR: 'Something went wrong. Please try again later.',
    UNAUTHORIZED: 'You are not authorized to access this resource.',
    NOT_FOUND: 'Resource not found.',
  },
};