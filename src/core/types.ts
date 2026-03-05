import { Request } from 'express';
import { UserRole } from '@prisma/client';

/* =====================================================
   🔐 JWT Payload
   What we encode inside Access & Refresh Tokens
===================================================== */

export interface TokenPayload {
  userId: string;
  role: UserRole;
  phoneNumber: string;

  // Added automatically by JWT
  iat?: number;
  exp?: number;
}

/* =====================================================
   📌 Express Request Extensions
===================================================== */

/**
 * After authentication middleware
 * (Protected routes)
 */
export interface AuthenticatedRequest extends Request {
  user: TokenPayload;
  requestId?: string;
}

/**
 * Before authentication (Public routes)
 */
export interface RequestWithUser extends Request {
  user?: TokenPayload;
  requestId?: string;
}

/* =====================================================
   📄 Pagination
===================================================== */

export interface PaginationMeta {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}

/* =====================================================
   📦 Standard API Response Structure
===================================================== */

export interface ApiSuccess<T> {
  success: true;
  message?: string;
  timestamp?: string;
  data: T;
}

export interface ApiFailure {
  success: false;
  message: string;
  timestamp?: string;
  errorCode?: string;
  details?: unknown;
}

/* =====================================================
   ☁️ File Upload (Multer + S3)
===================================================== */

export interface UploadedFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  buffer: Buffer;
  size: number;

  // After S3 Upload
  key?: string;          // S3 object key
  location?: string;     // Public S3 URL
  etag?: string;         // S3 ETag
}