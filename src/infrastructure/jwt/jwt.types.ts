import { TokenPayload } from '../../core/types';

/**
 * KAAGAZSEVA - JWT Infrastructure Types
 * Defines token shapes and identity contracts.
 */

/* =====================================================
   Token Pair Returned After Login / Refresh
===================================================== */
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

/* =====================================================
   Decoded JWT Payload
   (Includes standard JWT claims)
===================================================== */
export interface DecodedToken extends TokenPayload {
  iat: number; // Issued at
  exp: number; // Expiration timestamp
}

/* =====================================================
   Token Type Enum
   Used for validation logic and rotation handling
===================================================== */
export type TokenType = 'ACCESS' | 'REFRESH';

/* =====================================================
   Future-Ready Extension (Optional Upgrade)
   Token Versioning Support
===================================================== */
export interface VersionedTokenPayload extends TokenPayload {
  tokenVersion: number;
}