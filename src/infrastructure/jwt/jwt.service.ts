import jwt, { JwtPayload, SignOptions } from 'jsonwebtoken';
import { env } from '../../config/env';
import { AppError } from '../../core/AppError';
import { TokenPayload } from '../../core/types';

/**
 * KAAGAZSEVA - JWT Infrastructure Service
 * Responsible for:
 * - Signing access & refresh tokens
 * - Verifying token authenticity
 * - Enforcing token expiration discipline
 */
export class JwtService {
  private static readonly accessSecret = env.JWT_ACCESS_SECRET as string;
  private static readonly refreshSecret = env.JWT_REFRESH_SECRET as string;

  private static readonly accessExpiry =
    env.JWT_ACCESS_EXPIRES_IN as SignOptions['expiresIn'];

  private static readonly refreshExpiry =
    env.JWT_REFRESH_EXPIRES_IN as SignOptions['expiresIn'];

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

      const decoded = jwt.verify(
        token,
        this.accessSecret
      ) as JwtPayload;

      return decoded as TokenPayload;
    } catch (error: any) {
      if (error.name === 'TokenExpiredError') {
        throw new AppError(
          'Access token expired',
          401,
          true,
          'ACCESS_EXPIRED'
        );
      }

      throw new AppError(
        'Invalid access token',
        401,
        true,
        'ACCESS_INVALID'
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

      const decoded = jwt.verify(
        token,
        this.refreshSecret
      ) as JwtPayload;

      return decoded as TokenPayload;
    } catch (error: any) {
      if (error.name === 'TokenExpiredError') {
        throw new AppError(
          'Refresh token expired. Please login again.',
          401,
          true,
          'REFRESH_EXPIRED'
        );
      }

      throw new AppError(
        'Invalid refresh token',
        401,
        true,
        'REFRESH_INVALID'
      );
    }
  }
}