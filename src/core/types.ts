import { Request } from 'express';
import { UserRole } from '@prisma/client';

/* =====================================================
   JWT PAYLOAD
   Encoded inside Access & Refresh tokens
   Auth: Email + Password (no OTP, no phone in token)
===================================================== */

export interface TokenPayload {
  userId: string;
  role:   UserRole;
  email:  string;   // primary identifier — required

  // Added automatically by JWT library
  iat?: number;     // issued at
  exp?: number;     // expires at
}

/* =====================================================
   TOKEN PAIR
   Returned on login / token refresh
===================================================== */

export interface TokenPair {
  accessToken:  string;
  refreshToken: string;
  expiresIn:    number; // seconds until access token expires
}

/* =====================================================
   EXPRESS REQUEST EXTENSIONS
===================================================== */

/**
 * Protected routes — user is guaranteed to exist
 * Use with: asyncHandler<AuthenticatedRequest>
 */
export interface AuthenticatedRequest extends Request {
  user:       TokenPayload;
  requestId?: string;
}

/**
 * Public routes — user may or may not be present
 * Use with: asyncHandler<RequestWithUser>
 */
export interface RequestWithUser extends Request {
  user?:      TokenPayload;
  requestId?: string;
}

/* =====================================================
   PAGINATION
   Single definition — used by ApiResponse + controllers
===================================================== */

export interface PaginationMeta {
  page:       number;
  limit:      number;
  total:      number;
  totalPages: number;
  hasNext:    boolean;
  hasPrev:    boolean;
}

export interface PaginationQuery {
  page?:  number;
  limit?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}

export function buildPaginationMeta(
  page:  number,
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
   STANDARD API RESPONSE SHAPES
   Use these as frontend TypeScript types
===================================================== */

export interface ApiSuccess<T> {
  success:   true;
  message:   string;
  timestamp: string;
  data:      T;
  meta?:     PaginationMeta | Record<string, unknown>;
}

export interface ApiFailure {
  success:    false;
  message:    string;
  timestamp:  string;
  errorCode?: string;
  requestId?: string;
  errors?:    ValidationError[];
  details?:   unknown;
}

export interface ValidationError {
  field:   string;
  message: string;
  code:    string;
}

/* =====================================================
   FILE UPLOAD (Multer + S3)
===================================================== */

export interface UploadedFile {
  fieldname:    string;
  originalname: string;
  encoding:     string;
  mimetype:     string;
  buffer:       Buffer;
  size:         number;

  // After S3 upload
  key?:      string; // S3 object key
  location?: string; // never expose publicly — use pre-signed URLs
  etag?:     string; // S3 ETag
}

/* =====================================================
   GEOGRAPHY
===================================================== */

export interface LocationUpdate {
  latitude:  number;
  longitude: number;
}

export interface PincodeInfo {
  pincode:    string;
  district:   string;
  districtId: string;
  state:      string;
  stateId:    string;
  latitude?:  number;
  longitude?: number;
}

export interface Coordinates {
  latitude:  number;
  longitude: number;
}

/* =====================================================
   PRICING ENGINE
===================================================== */

export interface PricingCalculation {
  govtFee:            number;
  multiplier:         number;
  serviceFee:         number;
  platformCommission: number;
  agentCommission:    number;
  deliveryFee:        number;
  distanceKm:         number;
  totalAmount:        number;
  calculatedAt:       string; // ISO date
  pricingRuleId:      string;
}

/* =====================================================
   ASSIGNMENT ENGINE
===================================================== */

export interface AgentPriorityScore {
  agentId:       string;
  workloadScore: number;
  ratingScore:   number;
  speedScore:    number;
  penaltyScore:  number;
  totalScore:    number;
  distanceKm:    number;
}

export interface AssignmentResult {
  success:       boolean;
  agentId?:      string;
  assignmentId?: string;
  attemptNumber: number;
  fallbackUsed:  boolean;
}

/* =====================================================
   SYSTEM CONTROL
===================================================== */

export interface SystemStatus {
  paymentsFrozen:    boolean;
  withdrawalsFrozen: boolean;
  refundsFrozen:     boolean;
  assignmentsPaused: boolean;
  maintenanceMode:   boolean;
  updatedAt:         string;
  updatedBy?:        string;
  updateNote?:       string;
}