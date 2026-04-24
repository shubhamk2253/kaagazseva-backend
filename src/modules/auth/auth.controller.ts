import { Response }             from 'express';
import { AuthService }          from './auth.service';
import { asyncHandler }         from '../../core/asyncHandler';
import { ApiResponse }          from '../../core/ApiResponse';
import { AppError, ErrorCodes } from '../../core/AppError';
import { env, isProduction }    from '../../config/env';
import {
  AuthenticatedRequest,
  RequestWithUser,
}                               from '../../core/types';

/**
 * KAAGAZSEVA - Auth Controller
 * Email + Password authentication
 */

// Refresh token cookie config
const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure:   isProduction,
  sameSite: 'strict'  as const,
  maxAge:   30 * 24 * 60 * 60 * 1000, // 30 days (matches JWT_REFRESH_EXPIRES_IN)
};

export class AuthController {

  /* =====================================================
     POST /api/v1/auth/register
  ===================================================== */

  static register = asyncHandler(
    async (req: RequestWithUser, res: Response) => {
      const { name, email, password, phoneNumber } = req.body;

      const { user, tokens } = await AuthService.register({
        name,
        email,
        password,
        phoneNumber,
      });

      res.cookie('refreshToken', tokens.refreshToken, REFRESH_COOKIE_OPTIONS);

      return ApiResponse.created(res, 'Account created successfully', {
        user,
        accessToken: tokens.accessToken,
        expiresIn:   tokens.expiresIn,
      });
    }
  );

  /* =====================================================
     POST /api/v1/auth/login
  ===================================================== */

  static login = asyncHandler(
    async (req: RequestWithUser, res: Response) => {
      const { email, password } = req.body;

      const { user, tokens } = await AuthService.login(email, password);

      res.cookie('refreshToken', tokens.refreshToken, REFRESH_COOKIE_OPTIONS);

      return ApiResponse.success(res, 'Login successful', {
        user,
        accessToken: tokens.accessToken,
        expiresIn:   tokens.expiresIn,
      });
    }
  );

  /* =====================================================
     POST /api/v1/auth/refresh
     Refresh token from httpOnly cookie or body
  ===================================================== */

  static refreshToken = asyncHandler(
    async (req: RequestWithUser, res: Response) => {
      const token =
        req.cookies?.refreshToken ||
        req.body?.refreshToken;

      if (!token) {
        throw new AppError(
          'Refresh token missing',
          401, true, ErrorCodes.UNAUTHORIZED
        );
      }

      const { accessToken, expiresIn } =
        await AuthService.refreshSession(token);

      return ApiResponse.success(res, 'Token refreshed', {
        accessToken,
        expiresIn,
      });
    }
  );

  /* =====================================================
     POST /api/v1/auth/logout
  ===================================================== */

  static logout = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const token = req.cookies?.refreshToken;

      // Blacklist the token if present
      if (token) {
        await AuthService.logout(token, req.user.userId);
      }

      res.clearCookie('refreshToken', {
        httpOnly: true,
        secure:   isProduction,
        sameSite: 'strict',
      });

      return ApiResponse.success(res, 'Logged out successfully', null);
    }
  );

  /* =====================================================
     GET /api/v1/auth/me
     Get current authenticated user
  ===================================================== */

  static me = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const user = await AuthService.getMe(req.user.userId);

      return ApiResponse.success(res, 'User profile retrieved', user);
    }
  );

  /* =====================================================
     POST /api/v1/auth/change-password
  ===================================================== */

  static changePassword = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const { currentPassword, newPassword } = req.body;

      await AuthService.changePassword(
        req.user.userId,
        currentPassword,
        newPassword
      );

      // Invalidate all sessions
      const token = req.cookies?.refreshToken;
      if (token) {
        await AuthService.logout(token, req.user.userId);
      }

      res.clearCookie('refreshToken', {
        httpOnly: true,
        secure:   isProduction,
        sameSite: 'strict',
      });

      return ApiResponse.success(
        res,
        'Password changed. Please login again.',
        null
      );
    }
  );
}