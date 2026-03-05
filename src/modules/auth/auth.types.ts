import { UserRole } from '@prisma/client';

/**
 * KAAGAZSEVA - Auth Module Types
 * Defines the shape of data for authentication business logic.
 */

/**
 * 1️⃣ Request OTP Input
 */
export interface RequestOtpInput {
  phoneNumber: string;
}

/**
 * 2️⃣ Verify OTP Input
 */
export interface VerifyOtpInput {
  phoneNumber: string;
  otp: string;
}

/**
 * 3️⃣ Authenticated User Shape
 */
export interface AuthUser {
  id: string;
  phoneNumber: string;
  role: UserRole;
  name?: string | null;
}

/**
 * 4️⃣ Auth Tokens
 */
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

/**
 * 5️⃣ Final Auth Response
 */
export interface AuthResponse {
  user: AuthUser;
  tokens: AuthTokens;
}

/**
 * 6️⃣ Refresh Token Input
 */
export interface RefreshTokenInput {
  refreshToken: string;
}