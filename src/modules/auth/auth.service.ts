import { AuthRepository } from './auth.repository';
import { JwtService } from '../../infrastructure/jwt/jwt.service';
import { OtpService } from '../../services/otp.service';
import { OtpProvider } from '../../infrastructure/otp/otp.provider';
import { AppError } from '../../core/AppError';
import { UserRole } from '@prisma/client';
import logger from '../../core/logger';

/**
 * KAAGAZSEVA - Auth Service
 */

export class AuthService {

  /* =====================================================
     STEP 1 — Request OTP
  ===================================================== */
  static async requestOtp(phoneNumber: string) {

    if (!phoneNumber) {
      throw new AppError('Phone number required', 400);
    }

    const otp = OtpService.generateOTP();

    await OtpService.storeOTP(phoneNumber, otp);

    await OtpProvider.sendSms(phoneNumber, otp);

    return { message: 'OTP sent successfully' };
  }

  /* =====================================================
     STEP 2 — Verify OTP & Create Session
  ===================================================== */
  static async verifyOtp(phoneNumber: string, submittedOtp: string) {

    const isValid =
      await OtpService.verifyOTP(phoneNumber, submittedOtp);

    if (!isValid) {
      throw new AppError('Invalid OTP', 400);
    }

    // 🔒 Prevent OTP reuse
    await OtpService.clearOTP(phoneNumber);

    let user =
      await AuthRepository.findByPhone(phoneNumber);

    if (!user) {

      user =
        await AuthRepository.createWithWallet(
          phoneNumber,
          UserRole.CUSTOMER
        );

      logger.info({
        message: 'New customer registered',
        phoneNumber
      });
    }

    if (!user.isActive) {
      throw new AppError(
        'Account suspended. Contact support.',
        403
      );
    }

    const payload = {
      userId: user.id,
      role: user.role,
      phoneNumber: user.phoneNumber,
    };

    const accessToken =
      JwtService.signAccessToken(payload);

    const refreshToken =
      JwtService.signRefreshToken(payload);

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

  /* =====================================================
     STEP 3 — Refresh Access Token
  ===================================================== */
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