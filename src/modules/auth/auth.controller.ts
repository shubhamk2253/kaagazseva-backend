import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { asyncHandler } from '../../core/asyncHandler';
import { ApiResponse } from '../../core/ApiResponse';
import { AppError } from '../../core/AppError';
import { env } from '../../config/env';
import { RequestWithUser } from '../../core/types';

/**
 * KAAGAZSEVA - Auth Controller
 */

export class AuthController {

  /**
   * POST /api/v1/auth/send-otp
   */
  static sendOtp = asyncHandler(async (req: RequestWithUser, res: Response) => {

    const { phoneNumber } = req.body;

    const result = await AuthService.requestOtp(phoneNumber);

    return ApiResponse.success(
      res,
      result.message,
      { phoneNumber, requestId: req.requestId }
    );
  });

  /**
   * Alias for backward compatibility
   * POST /api/v1/auth/request-otp
   */
  static requestOtp = asyncHandler(async (req: RequestWithUser, res: Response) => {

    const { phoneNumber } = req.body;

    const result = await AuthService.requestOtp(phoneNumber);

    return ApiResponse.success(
      res,
      result.message,
      { phoneNumber, requestId: req.requestId }
    );
  });

  /**
   * POST /api/v1/auth/verify-otp
   */
  static verifyOtp = asyncHandler(async (req: RequestWithUser, res: Response) => {

    const { phoneNumber, otp } = req.body;

    const { user, tokens } =
      await AuthService.verifyOtp(phoneNumber, otp);

    res.cookie('refreshToken', tokens.refreshToken, {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return ApiResponse.success(
      res,
      'Login successful',
      {
        user,
        accessToken: tokens.accessToken,
        requestId: req.requestId,
      }
    );
  });

  /**
   * POST /api/v1/auth/refresh
   */
  static refreshToken = asyncHandler(async (req: RequestWithUser, res: Response) => {

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
      {
        accessToken,
        requestId: req.requestId,
      }
    );
  });

  /**
   * POST /api/v1/auth/logout
   */
  static logout = asyncHandler(async (req: RequestWithUser, res: Response) => {

    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: 'strict',
    });

    return ApiResponse.success(
      res,
      'Logged out successfully',
      { requestId: req.requestId }
    );
  });
}