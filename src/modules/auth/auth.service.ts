import { AuthRepository } from './auth.repository';
import { JwtService } from '../../infrastructure/jwt/jwt.service';
import { AppError } from '../../core/AppError';
import { UserRole } from '@prisma/client';
import logger from '../../core/logger';

/**
 * KAAGAZSEVA - Auth Service
 * Firebase Authentication Version
 */

export class AuthService {

  //////////////////////////////////////////////////////
  // FIREBASE LOGIN
  //////////////////////////////////////////////////////

  static async firebaseLogin(phoneNumber: string) {

    if (!phoneNumber) {
      throw new AppError('Phone number required', 400);
    }

    let user =
      await AuthRepository.findByPhone(phoneNumber);

    //////////////////////////////////////////////////////
    // CREATE USER IF NOT EXISTS
    //////////////////////////////////////////////////////

    if (!user) {

      user =
        await AuthRepository.createWithWallet(
          phoneNumber,
          UserRole.CUSTOMER
        );

      logger.info({
        event: 'NEW_CUSTOMER_REGISTERED',
        phoneNumber
      });

    }

    //////////////////////////////////////////////////////
    // ACCOUNT STATUS CHECK
    //////////////////////////////////////////////////////

    if (!user.isActive) {
      throw new AppError(
        'Account suspended. Contact support.',
        403
      );
    }

    //////////////////////////////////////////////////////
    // CREATE TOKENS
    //////////////////////////////////////////////////////

    const payload = {
      userId: user.id,
      role: user.role,
      phoneNumber: user.phoneNumber,
    };

    const accessToken =
      JwtService.signAccessToken(payload);

    const refreshToken =
      JwtService.signRefreshToken(payload);

    //////////////////////////////////////////////////////
    // RESPONSE
    //////////////////////////////////////////////////////

    return {
      user: {
        id: user.id,
        phoneNumber: user.phoneNumber,
        role: user.role,
        name: user.name,
        walletBalance: Number(user.wallet?.balance ?? 0),
      },
      tokens: {
        accessToken,
        refreshToken,
      },
    };

  }

  //////////////////////////////////////////////////////
  // REFRESH ACCESS TOKEN
  //////////////////////////////////////////////////////

  static async refreshSession(refreshToken: string) {

    const decoded =
      JwtService.verifyRefreshToken(refreshToken);

    const user =
      await AuthRepository.findById(decoded.userId);

    if (!user || !user.isActive) {
      throw new AppError('User no longer active', 401);
    }

    const payload = {
      userId: user.id,
      role: user.role,
      phoneNumber: user.phoneNumber,
    };

    const newAccessToken =
      JwtService.signAccessToken(payload);

    return { accessToken: newAccessToken };

  }

}