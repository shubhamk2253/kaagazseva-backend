import { TokenPayload } from '../../core/types';

/**
 * KAAGAZSEVA - JWT Infrastructure Types
 * Token shapes and identity contracts.
 *
 * Note: TokenPair (accessToken + refreshToken + expiresIn)
 * is defined in core/types.ts — import from there.
 */

/* =====================================================
   DECODED TOKEN
   JWT payload after jwt.verify()
   iat/exp are optional in TokenPayload but
   always present after successful decode
===================================================== */

export interface DecodedToken extends TokenPayload {
  iat: number; // issued at (unix timestamp)
  exp: number; // expiration (unix timestamp)
}

/* =====================================================
   TOKEN TYPE
   Used in validation and middleware logic
===================================================== */

export type TokenType = 'ACCESS' | 'REFRESH';

/* =====================================================
   VERSIONED TOKEN PAYLOAD
   Enables forced logout + token rotation
   Increment tokenVersion in DB on:
   - Password change
   - Security breach
   - Admin forced logout
   Any token with old version is rejected
===================================================== */

export interface VersionedTokenPayload extends TokenPayload {
  tokenVersion: number;
}

/* =====================================================
   TOKEN SESSION METADATA
   Stored in AuditLog for device tracking
===================================================== */

export interface TokenSessionMeta {
  ip?:        string;
  userAgent?: string;
  deviceId?:  string;
}