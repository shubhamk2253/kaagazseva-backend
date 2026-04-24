import { UserRole }  from '@prisma/client';
import { TokenPair } from '../../core/types';

/**
 * KAAGAZSEVA - Auth Module Types
 * Email + Password authentication
 */

/* =====================================================
   AUTH USER — returned in all auth responses
===================================================== */

export interface AuthUser {
  id:            string;
  name:          string | null;
  email:         string;
  role:          UserRole;
  phoneNumber?:  string | null;
  walletBalance: number;
  isActive:      boolean;
}

/* =====================================================
   AUTH RESPONSE — login + register
===================================================== */

export interface AuthResponse {
  user:   AuthUser;
  tokens: TokenPair; // accessToken + refreshToken + expiresIn
}

/* =====================================================
   REGISTER INPUT
===================================================== */

export interface RegisterInput {
  name?:        string;
  email:        string;
  password:     string;
  phoneNumber?: string;
}

/* =====================================================
   LOGIN INPUT
===================================================== */

export interface LoginInput {
  email:    string;
  password: string;
}

/* =====================================================
   REFRESH TOKEN INPUT
===================================================== */

export interface RefreshTokenInput {
  refreshToken?: string; // optional — may come from cookie
}

/* =====================================================
   CHANGE PASSWORD INPUT
===================================================== */

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword:     string;
  confirmPassword: string;
}

/* =====================================================
   TOKEN SESSION — for audit logging
===================================================== */

export interface TokenSession {
  userId:    string;
  email:     string;
  role:      UserRole;
  ip?:       string;
  userAgent?: string;
}