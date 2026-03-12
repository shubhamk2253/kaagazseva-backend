import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { asyncHandler } from '../../core/asyncHandler';
import { ApiResponse } from '../../core/ApiResponse';
import { AppError } from '../../core/AppError';
import { env } from '../../config/env';
import { RequestWithUser } from '../../core/types';

/**
 * KAAGAZSEVA - Auth Controller
 * Firebase Login Version
 */

export class AuthController {

  //////////////////////////////////////////////////////
  // FIREBASE LOGIN
  // POST /api/v1/auth/firebase-login
  //////////////////////////////////////////////////////

  static firebaseLogin = asyncHandler(async (req: RequestWithUser, res: Response) => {

    const { phoneNumber } = req.body;

    if (!phoneNumber) {
      throw new AppError('Phone number required', 400);
    }

    const { user, tokens } =
      await AuthService.firebaseLogin(phoneNumber);

    //////////////////////////////////////////////////////
    // SET REFRESH COOKIE
    //////////////////////////////////////////////////////

    res.cookie('refreshToken', tokens.refreshToken, {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    //////////////////////////////////////////////////////
    // RESPONSE
    //////////////////////////////////////////////////////

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

  //////////////////////////////////////////////////////
  // REFRESH TOKEN
  //////////////////////////////////////////////////////

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

  //////////////////////////////////////////////////////
  // LOGOUT
  //////////////////////////////////////////////////////

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