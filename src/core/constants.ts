/**
 * KAAGAZSEVA - Global Constants
 * National-Level GovTech Infrastructure
 *
 * IMPORTANT:
 * Do NOT redefine Prisma enums here.
 * Import them directly from @prisma/client.
 * This keeps enums in sync with schema automatically.
 */

/* =====================================================
   RE-EXPORT PRISMA ENUMS
   Single source of truth — always matches schema
===================================================== */

export {
  UserRole,
  ApplicationStatus,
  AssignmentStatus,
  ServiceMode,
  ServiceScope,
  TransactionType,
  TransactionStatus,
  DocumentStatus,
  SuspensionStatus,
  WithdrawalStatus,
  NotificationType,
  TicketStatus,
  TicketPriority,
  TicketCategory,
  AuditAction,
  RefundStatus,
  KycStatus,
  PayoutStatus,
} from '@prisma/client';

/* =====================================================
   PRICING ENGINE
   Core business rules — never hardcode these elsewhere
===================================================== */

export const PRICING = {

  // Slab multipliers on government fee
  SLABS: [
    { min: 0,    max: 200,       multiplier: 2.5 },
    { min: 201,  max: 1000,      multiplier: 1.5 },
    { min: 1001, max: 3000,      multiplier: 1.0 },
    { min: 3001, max: Infinity,  multiplier: 0.6 },
  ],

  MIN_SERVICE_FEE_INR:      99,
  MAX_SERVICE_FEE_INR:      800,

  PLATFORM_COMMISSION_PCT:  0.25,   // 25%
  MIN_PLATFORM_COMMISSION:  30,     // ₹30 minimum
  AGENT_COMMISSION_PCT:     0.75,   // 75%

  DELIVERY_BASE_FEE_INR:    30,     // ₹30 base
  DELIVERY_PER_KM_INR:      12,     // ₹12 per km
  MAX_SERVICE_RADIUS_KM:    25,     // 25km max

} as const;

/* =====================================================
   ASSIGNMENT ENGINE
===================================================== */

export const ASSIGNMENT = {

  MAX_ACTIVE_CASES_PER_AGENT:     25,
  ASSIGNMENT_ACCEPT_TIMEOUT_MINS: 60,
  GEO_SEARCH_RADIUS_KM:           25,

  // Fallback chain delays (minutes between attempts)
  RETRY_DELAYS_MINS: [5, 10, 15, 30],

} as const;

/* =====================================================
   ESCROW ENGINE
===================================================== */

export const ESCROW = {

  // Hours before auto-release after completion confirmed
  AUTO_RELEASE_HOURS:    72,   // 3 days

  // Cron job check interval
  CRON_INTERVAL_MINS:    5,

  // Max hold period before admin alert
  MAX_HOLD_DAYS:         30,

} as const;

/* =====================================================
   SYSTEM LIMITS
===================================================== */

export const SYSTEM_LIMITS = {

  // File uploads
  MAX_FILE_SIZE_MB:           5,
  MAX_FILES_PER_APPLICATION:  10,
  ALLOWED_MIME_TYPES: [
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/pdf',
  ],

  // OTP
  OTP_EXPIRY_SECONDS:   600,   // 10 minutes
  MAX_OTP_ATTEMPTS:     3,

  // Authentication
  ACCESS_TOKEN_EXPIRY_MINS:  15,
  REFRESH_TOKEN_EXPIRY_DAYS: 30,

  // Wallet
  MAX_WITHDRAWALS_PER_DAY:   3,
  MIN_WITHDRAWAL_AMOUNT_INR: 100,

  // Agent
  MAX_ACTIVE_CASES:    25,
  PROBATION_JOBS:      10,     // first 10 jobs are monitored

} as const;

/* =====================================================
   SECURITY
===================================================== */

export const SECURITY = {

  MAX_LOGIN_ATTEMPTS:   5,
  ACCOUNT_LOCK_MINS:    30,

  // Pre-signed URL expiry
  S3_READ_URL_EXPIRY_SECS:   7200,  // 2 hours
  S3_UPLOAD_URL_EXPIRY_SECS: 900,   // 15 minutes

  // Fraud thresholds
  HIGH_REFUND_RATE_THRESHOLD: 0.20,  // 20% refund rate = flag
  FAST_COMPLETION_THRESHOLD_MINS: 10, // completed in <10 min = flag

} as const;

/* =====================================================
   PAGINATION
===================================================== */

export const PAGINATION = {

  DEFAULT_PAGE:  1,
  DEFAULT_LIMIT: 20,
  MAX_LIMIT:     100,

} as const;

/* =====================================================
   RATE LIMITS
   Mirrors rateLimit.middleware.ts
   Single source of truth for limit values
===================================================== */

export const RATE_LIMITS = {

  GLOBAL: {
    WINDOW_MS: 15 * 60 * 1000,  // 15 minutes
    MAX:       300,
  },

  AUTH: {
    WINDOW_MS: 10 * 60 * 1000,  // 10 minutes
    MAX:       10,
  },

  CRITICAL: {
    WINDOW_MS: 10 * 60 * 1000,  // 10 minutes
    MAX:       20,
  },

  PAYMENT: {
    WINDOW_MS: 60 * 60 * 1000,  // 1 hour
    MAX:       10,
  },

  UPLOAD: {
    WINDOW_MS: 60 * 60 * 1000,  // 1 hour
    MAX:       20,
  },

  REFUND: {
    WINDOW_MS: 24 * 60 * 60 * 1000, // 24 hours
    MAX:       5,
  },

} as const;

/* =====================================================
   STANDARD RESPONSE MESSAGES
===================================================== */

export const MESSAGES = {

  AUTH: {
    OTP_SENT:         'OTP sent successfully.',
    INVALID_OTP:      'Invalid or expired OTP.',
    LOGIN_SUCCESS:     'Logged in successfully.',
    TOKEN_REFRESHED:  'Session refreshed successfully.',
    LOGOUT:           'Logged out successfully.',
    REGISTER_SUCCESS: 'Account created successfully.',
  },

  APPLICATION: {
    CREATED:        'Application created successfully.',
    UPDATED:        'Application updated successfully.',
    STATUS_CHANGED: 'Application status updated.',
    FETCHED:        'Application fetched successfully.',
    LIST_FETCHED:   'Applications fetched successfully.',
    CANCELLED:      'Application cancelled successfully.',
    COMPLETED:      'Service completed successfully.',
    CONFIRMED:      'Completion confirmed. Payment released.',
  },

  AGENT: {
    ASSIGNED:   'Agent assigned successfully.',
    ACCEPTED:   'Job accepted successfully.',
    REJECTED:   'Job rejected.',
    COMPLETED:  'Service marked as complete.',
    LOCATION_UPDATED: 'Location updated.',
  },

  PAYMENT: {
    ORDER_CREATED: 'Payment order created.',
    SUCCESS:       'Payment successful.',
    FAILED:        'Payment failed. Please try again.',
    VERIFIED:      'Payment verified successfully.',
    REFUND_INIT:   'Refund initiated.',
  },

  WALLET: {
    FETCHED:              'Wallet fetched successfully.',
    WITHDRAWAL_REQUESTED: 'Withdrawal request submitted.',
    WITHDRAWAL_APPROVED:  'Withdrawal approved successfully.',
    WITHDRAWAL_REJECTED:  'Withdrawal request rejected.',
  },

  REFUND: {
    REQUESTED: 'Refund request submitted.',
    APPROVED:  'Refund approved.',
    REJECTED:  'Refund request rejected.',
    PROCESSED: 'Refund processed successfully.',
  },

  TICKET: {
    CREATED:   'Support ticket created.',
    UPDATED:   'Ticket updated.',
    RESOLVED:  'Ticket resolved.',
    CLOSED:    'Ticket closed.',
  },

  NOTIFICATION: {
    FETCHED:    'Notifications fetched.',
    MARKED_READ: 'Notifications marked as read.',
  },

  GENERIC: {
    SUCCESS:      'Request processed successfully.',
    ERROR:        'Something went wrong. Please try again later.',
    UNAUTHORIZED: 'You are not authorized to access this resource.',
    FORBIDDEN:    'Access denied.',
    NOT_FOUND:    'Resource not found.',
    DELETED:      'Deleted successfully.',
  },

} as const;

/* =====================================================
   AUDIT EVENTS
   Specific events for compliance logging
===================================================== */

export const AUDIT_EVENTS = {

  // Auth
  USER_LOGIN:           'USER_LOGIN',
  USER_LOGOUT:          'USER_LOGOUT',
  TOKEN_REFRESHED:      'TOKEN_REFRESHED',

  // Applications
  APPLICATION_CREATED:  'APPLICATION_CREATED',
  APPLICATION_STATUS_CHANGED: 'APPLICATION_STATUS_CHANGED',
  APPLICATION_CANCELLED: 'APPLICATION_CANCELLED',

  // Payments
  PAYMENT_INITIATED:    'PAYMENT_INITIATED',
  PAYMENT_CAPTURED:     'PAYMENT_CAPTURED',
  PAYMENT_FAILED:       'PAYMENT_FAILED',
  ESCROW_RELEASED:      'ESCROW_RELEASED',
  REFUND_INITIATED:     'REFUND_INITIATED',

  // Agents
  AGENT_ASSIGNED:       'AGENT_ASSIGNED',
  AGENT_ACCEPTED:       'AGENT_ACCEPTED',
  AGENT_REJECTED:       'AGENT_REJECTED',
  AGENT_TIMED_OUT:      'AGENT_TIMED_OUT',

  // Wallet
  WITHDRAWAL_REQUESTED: 'WITHDRAWAL_REQUESTED',
  WITHDRAWAL_APPROVED:  'WITHDRAWAL_APPROVED',
  WITHDRAWAL_REJECTED:  'WITHDRAWAL_REJECTED',

  // Admin
  SYSTEM_FROZEN:        'SYSTEM_FROZEN',
  SYSTEM_UNFROZEN:      'SYSTEM_UNFROZEN',
  AGENT_SUSPENDED:      'AGENT_SUSPENDED',
  AGENT_REINSTATED:     'AGENT_REINSTATED',

} as const;