import { prisma } from '../../config/database';
import logger from '../../core/logger';
import { AppError } from '../../core/AppError';

export class OtpService {

  //////////////////////////////////////////////////////
  // SAVE OTP
  //////////////////////////////////////////////////////

  static async saveOTP(
    mobile: string,
    code: string,
    expiresAt: Date
  ) {

    return prisma.otp.create({
      data: {
        mobile,
        code,
        expiresAt,
      },
    });

  }

  //////////////////////////////////////////////////////
  // VERIFY OTP
  //////////////////////////////////////////////////////

  static async verifyOTP(
    mobile: string,
    code: string
  ) {

    const otp = await prisma.otp.findFirst({
      where: {
        mobile,
        code,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (!otp) {
      throw new AppError('Invalid OTP', 400);
    }

    if (otp.expiresAt < new Date()) {
      throw new AppError('OTP expired', 400);
    }

    return otp;

  }

  //////////////////////////////////////////////////////
  // CLEAR OTP
  //////////////////////////////////////////////////////

  static async clearOTP(mobile: string) {

    try {

      await prisma.otp.deleteMany({
        where: {
          mobile,
        },
      });

      logger.info({
        event: 'OTP_CLEARED',
        mobile,
      });

    } catch (error) {

      logger.error({
        event: 'OTP_CLEAR_FAILED',
        mobile,
        error,
      });

      throw new AppError('Failed to clear OTP', 500);

    }

  }

}