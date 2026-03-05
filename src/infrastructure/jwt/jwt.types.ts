import { TokenPayload } from '../../core/types';

/**
 * KAAGAZSEVA - JWT Infrastructure Types
 * Defines token shapes and identity contracts.
 */

/* =====================================================
   TOKEN PAIR
   Returned after login / refresh
===================================================== */
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

/* =====================================================
   DECODED TOKEN
   JWT payload + standard JWT claims
===================================================== */
export interface DecodedToken extends TokenPayload {
  iat: number; // issued at (unix timestamp)
  exp: number; // expiration timestamp
}

/* =====================================================
   TOKEN TYPE
   Used in token validation logic
===================================================== */
export type TokenType = 'ACCESS' | 'REFRESH';

/* =====================================================
   VERSIONED TOKEN PAYLOAD
   Enables forced logout + token rotation
===================================================== */
export interface VersionedTokenPayload extends TokenPayload {
  tokenVersion: number;
}

/* =====================================================
   OPTIONAL SESSION METADATA
   Useful for audit logging / device tracking
===================================================== */
export interface TokenSessionMeta {
  ip?: string;
  userAgent?: string;
  deviceId?: string;
}