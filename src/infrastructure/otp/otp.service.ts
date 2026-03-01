import crypto from 'crypto';
import {redis} from '../../config/redis';
import { AppError } from '../../core/AppError';
import { SYSTEM_LIMITS } from '../../core/constants';
import logger from '../../core/logger';

/**
 * KAAGAZSEVA - OTP Infrastructure Service
 * Secure OTP generation, storage, and validation.
 */
export class OtpService {
  private static readonly OTP_PREFIX = 'otp:';
  private static readonly OTP_ATTEMPT_PREFIX = 'otp_attempt:';

  /**
   * Generates a cryptographically secure 6-digit OTP
   */
  static generateOTP(): string {
    // crypto-safe random number
    const otp = crypto.randomInt(100000, 999999);
    return otp.toString();
  }

  /**
   * Stores OTP in Redis with expiry
   */
  static async storeOTP(phoneNumber: string, otp: string): Promise<void> {
    const key = `${this.OTP_PREFIX}${phoneNumber}`;
    const attemptKey = `${this.OTP_ATTEMPT_PREFIX}${phoneNumber}`;

    try {
      await redis.set(key, otp, 'EX', SYSTEM_LIMITS.OTP_EXPIRY_SECONDS);

      // Reset attempt counter
      await redis.set(attemptKey, 0, 'EX', SYSTEM_LIMITS.OTP_EXPIRY_SECONDS);

    } catch (error) {
      logger.error(`OTP Store Error: ${error}`);
      throw new AppError('Failed to process security code', 500);
    }
  }

  /**
   * Verifies OTP securely
   */
  static async verifyOTP(
    phoneNumber: string,
    submittedOtp: string
  ): Promise<boolean> {
    const key = `${this.OTP_PREFIX}${phoneNumber}`;
    const attemptKey = `${this.OTP_ATTEMPT_PREFIX}${phoneNumber}`;

    try {
      const storedOtp = await redis.get(key);

      if (!storedOtp) {
        throw new AppError('OTP expired or not requested', 400);
      }

      // Check attempt count
      const attempts = Number(await redis.get(attemptKey)) || 0;

      if (attempts >= SYSTEM_LIMITS.MAX_OTP_ATTEMPTS) {
        await redis.del(key);
        await redis.del(attemptKey);
        throw new AppError('Maximum OTP attempts exceeded', 429);
      }

      // Constant-time comparison to prevent timing attacks
      const isValid = crypto.timingSafeEqual(
        Buffer.from(storedOtp),
        Buffer.from(submittedOtp)
      );

      if (!isValid) {
        await redis.incr(attemptKey);
        return false;
      }

      // Success → Delete OTP (Prevents replay attack)
      await redis.del(key);
      await redis.del(attemptKey);

      return true;

    } catch (error) {
      if (error instanceof AppError) throw error;

      logger.error(`OTP Verify Error: ${error}`);
      throw new AppError('Error verifying security code', 500);
    }
  }
}