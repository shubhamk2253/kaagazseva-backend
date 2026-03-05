import jwt, { SignOptions } from 'jsonwebtoken';
import { env } from '../../config/env';
import { AppError } from '../../core/AppError';
import { TokenPayload } from '../../core/types';

/**
 * KAAGAZSEVA - JWT Infrastructure Service
 * Handles signing and verification of JWT tokens.
 */

export class JwtService {

  private static readonly accessSecret = env.JWT_ACCESS_SECRET as string;
  private static readonly refreshSecret = env.JWT_REFRESH_SECRET as string;

  private static readonly accessExpiry =
    env.JWT_ACCESS_EXPIRES_IN as SignOptions['expiresIn'];

  private static readonly refreshExpiry =
    env.JWT_REFRESH_EXPIRES_IN as SignOptions['expiresIn'];

  /* =====================================================
     INTERNAL VALIDATION
  ===================================================== */

  private static validatePayload(payload: any): TokenPayload {

    if (
      !payload ||
      typeof payload !== 'object' ||
      !payload.userId ||
      !payload.role ||
      !payload.phoneNumber
    ) {
      throw new AppError(
        'Invalid token payload',
        401,
        true,
        'TOKEN_PAYLOAD_INVALID'
      );
    }

    return payload as TokenPayload;
  }

  /* =====================================================
     ACCESS TOKEN
  ===================================================== */

  static signAccessToken(payload: TokenPayload): string {

    if (!this.accessSecret) {
      throw new Error('JWT_ACCESS_SECRET is not defined');
    }

    const options: SignOptions = {
      expiresIn: this.accessExpiry,
    };

    return jwt.sign(payload, this.accessSecret, options);
  }

  static verifyAccessToken(token: string): TokenPayload {

    try {

      if (!this.accessSecret) {
        throw new Error('JWT_ACCESS_SECRET is not defined');
      }

      const decoded = jwt.verify(token, this.accessSecret);

      return this.validatePayload(decoded);

    } catch (error: any) {

      if (error.name === 'TokenExpiredError') {
        throw new AppError(
          'Access token expired',
          401,
          true,
          'ACCESS_EXPIRED'
        );
      }

      if (error.name === 'JsonWebTokenError') {
        throw new AppError(
          'Invalid access token',
          401,
          true,
          'ACCESS_INVALID'
        );
      }

      throw new AppError(
        'Token verification failed',
        401,
        true,
        'ACCESS_VERIFY_FAILED'
      );
    }
  }

  /* =====================================================
     REFRESH TOKEN
  ===================================================== */

  static signRefreshToken(payload: TokenPayload): string {

    if (!this.refreshSecret) {
      throw new Error('JWT_REFRESH_SECRET is not defined');
    }

    const options: SignOptions = {
      expiresIn: this.refreshExpiry,
    };

    return jwt.sign(payload, this.refreshSecret, options);
  }

  static verifyRefreshToken(token: string): TokenPayload {

    try {

      if (!this.refreshSecret) {
        throw new Error('JWT_REFRESH_SECRET is not defined');
      }

      const decoded = jwt.verify(token, this.refreshSecret);

      return this.validatePayload(decoded);

    } catch (error: any) {

      if (error.name === 'TokenExpiredError') {
        throw new AppError(
          'Refresh token expired. Please login again.',
          401,
          true,
          'REFRESH_EXPIRED'
        );
      }

      if (error.name === 'JsonWebTokenError') {
        throw new AppError(
          'Invalid refresh token',
          401,
          true,
          'REFRESH_INVALID'
        );
      }

      throw new AppError(
        'Refresh token verification failed',
        401,
        true,
        'REFRESH_VERIFY_FAILED'
      );
    }
  }
}