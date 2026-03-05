/**
 * KAAGAZSEVA - Global Constants
 * National-Level GovTech Infrastructure Standardization
 */

/* =========================================================
   USER ROLES
========================================================= */


/* =========================================================
   SERVICE MODES
========================================================= */

export enum ServiceMode {
  DIGITAL = 'DIGITAL',
  DOORSTEP = 'DOORSTEP',
  FULL_SERVICE = 'FULL_SERVICE',
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
   WALLET & TRANSACTIONS
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
   AUDIT EVENTS (Compliance Logging)
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

  // File Uploads
  MAX_FILE_SIZE_MB: 5,
  MAX_FILES_PER_APPLICATION: 10,

  // OTP
  OTP_EXPIRY_SECONDS: 300,
  MAX_OTP_ATTEMPTS: 3,

  // Authentication
  ACCESS_TOKEN_EXPIRY_MINUTES: 15,
  REFRESH_TOKEN_EXPIRY_DAYS: 7,

  // Wallet
  MAX_WITHDRAWALS_PER_DAY: 3,
};

/* =========================================================
   SECURITY RULES
========================================================= */

export const SECURITY = {
  MAX_LOGIN_ATTEMPTS: 5,
  ACCOUNT_LOCK_MINUTES: 30,
};

/* =========================================================
   ESCROW ENGINE
========================================================= */

export const ESCROW = {

  // Escrow hold before release
  AUTO_RELEASE_HOURS: 24,

  // Cron job interval
  CRON_INTERVAL_MINUTES: 5,

};

/* =========================================================
   REFUND RULES
========================================================= */

export const REFUND = {

  // Refund limits
  MAX_REFUND_PERCENTAGE: 100,

  // Minimum refund amount
  MIN_REFUND_AMOUNT: 100, // ₹1

};

/* =========================================================
   ASSIGNMENT ENGINE
========================================================= */

export const ASSIGNMENT = {

  MAX_ACTIVE_CASES_PER_AGENT: 25,

  ASSIGNMENT_ACCEPT_TIME_MINUTES: 60,

  GEO_SEARCH_RADIUS_KM: 25,

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