import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { asyncHandler } from '../../core/asyncHandler';
import { ApiResponse } from '../../core/ApiResponse';
import { AppError } from '../../core/AppError';
import { env } from '../../config/env';

/**
 * KAAGAZSEVA - Auth Controller
 * HTTP layer for authentication.
 */
export class AuthController {

  /**
   * POST /api/v1/auth/request-otp
   */
  static requestOtp = asyncHandler(async (req: Request, res: Response) => {
    const { phoneNumber } = req.body;

    const result = await AuthService.requestOtp(phoneNumber);

    return ApiResponse.success(
      res,
      result.message,
      { phoneNumber }
    );
  });

  /**
   * POST /api/v1/auth/verify-otp
   */
  static verifyOtp = asyncHandler(async (req: Request, res: Response) => {
    const { phoneNumber, otp } = req.body;

    const { user, tokens } = await AuthService.verifyOtp(phoneNumber, otp);

    // 🔐 Secure Refresh Token Cookie
    res.cookie('refreshToken', tokens.refreshToken, {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    return ApiResponse.success(
      res,
      'Login successful',
      {
        user,
        accessToken: tokens.accessToken,
      }
    );
  });

  /**
   * POST /api/v1/auth/refresh
   */
  static refreshToken = asyncHandler(async (req: Request, res: Response) => {

    const token =
      req.cookies?.refreshToken ||
      req.body?.refreshToken;

    if (!token) {
      throw new AppError('Refresh token missing', 401);
    }

    const { accessToken } =
      await AuthService.refreshSession(token);

    return ApiResponse.success(
      res,
      'Token refreshed',
      { accessToken }
    );
  });

  /**
   * POST /api/v1/auth/logout
   */
  static logout = asyncHandler(async (_req: Request, res: Response) => {

    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: 'lax',
    });

    return ApiResponse.success(
      res,
      'Logged out successfully'
    );
  });
}