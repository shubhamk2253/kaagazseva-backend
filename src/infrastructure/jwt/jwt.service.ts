import jwt, { SignOptions } from 'jsonwebtoken';
import { env } from '../../config/env';
import { AppError } from '../../core/AppError';
import { TokenPayload, TokenPair } from '../../core/types';

/**
 * KAAGAZSEVA - JWT Infrastructure Service
 * Auth: Email + Password
 *
 * Access Token:  15 minutes (short-lived)
 * Refresh Token: 30 days (long-lived, httpOnly cookie)
 */

export class JwtService {

  private static readonly accessSecret  = env.JWT_ACCESS_SECRET;
  private static readonly refreshSecret = env.JWT_REFRESH_SECRET;

  private static readonly accessExpiry =
    env.JWT_ACCESS_EXPIRES_IN as SignOptions['expiresIn'];

  private static readonly refreshExpiry =
    env.JWT_REFRESH_EXPIRES_IN as SignOptions['expiresIn'];

  /* =====================================================
     PAYLOAD VALIDATION
  ===================================================== */

  private static validatePayload(payload: any): TokenPayload {
    if (
      !payload           ||
      typeof payload !== 'object' ||
      !payload.userId    ||
      !payload.role      ||
      !payload.email        // email required — primary identifier
    ) {
      throw new AppError(
        'Invalid token payload',
        401, true,
        'TOKEN_PAYLOAD_INVALID'
      );
    }

    return payload as TokenPayload;
  }

  /* =====================================================
     ACCESS TOKEN
  ===================================================== */

  static signAccessToken(payload: TokenPayload): string {
    return jwt.sign(
      payload,
      this.accessSecret,
      { expiresIn: this.accessExpiry }
    );
  }

  static verifyAccessToken(token: string): TokenPayload {
    try {
      const decoded = jwt.verify(token, this.accessSecret);
      return this.validatePayload(decoded);
    } catch (error: any) {
      if (error.name === 'TokenExpiredError') {
        throw new AppError(
          'Access token expired',
          401, true, 'ACCESS_EXPIRED'
        );
      }
      if (error.name === 'JsonWebTokenError') {
        throw new AppError(
          'Invalid access token',
          401, true, 'ACCESS_INVALID'
        );
      }
      throw new AppError(
        'Token verification failed',
        401, true, 'ACCESS_VERIFY_FAILED'
      );
    }
  }

  /* =====================================================
     REFRESH TOKEN
  ===================================================== */

  static signRefreshToken(payload: TokenPayload): string {
    return jwt.sign(
      payload,
      this.refreshSecret,
      { expiresIn: this.refreshExpiry }
    );
  }

  static verifyRefreshToken(token: string): TokenPayload {
    try {
      const decoded = jwt.verify(token, this.refreshSecret);
      return this.validatePayload(decoded);
    } catch (error: any) {
      if (error.name === 'TokenExpiredError') {
        throw new AppError(
          'Refresh token expired. Please login again.',
          401, true, 'REFRESH_EXPIRED'
        );
      }
      if (error.name === 'JsonWebTokenError') {
        throw new AppError(
          'Invalid refresh token',
          401, true, 'REFRESH_INVALID'
        );
      }
      throw new AppError(
        'Refresh token verification failed',
        401, true, 'REFRESH_VERIFY_FAILED'
      );
    }
  }

  /* =====================================================
     CONVENIENCE METHODS
  ===================================================== */

  // Generate both tokens — used on login + refresh
  static generateTokenPair(payload: TokenPayload): TokenPair {
    return {
      accessToken:  this.signAccessToken(payload),
      refreshToken: this.signRefreshToken(payload),
      expiresIn:    15 * 60, // 15 minutes in seconds
    };
  }

  // Read expired token payload — useful for refresh flow
  static decodeWithoutVerify(token: string): TokenPayload | null {
    try {
      const decoded = jwt.decode(token);
      return decoded as TokenPayload | null;
    } catch {
      return null;
    }
  }

  // Extract Bearer token from Authorization header
  static extractFromHeader(authHeader: string | undefined): string | null {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }
    return authHeader.substring(7);
  }

}