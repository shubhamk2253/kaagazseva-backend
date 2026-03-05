import axios from 'axios';
import { prisma } from '../config/database';
import logger from '../core/logger';
import { AppError } from '../core/AppError';

/* =====================================================
   ENV VALIDATION
===================================================== */

const AUTH_KEY = process.env.MSG91_AUTH_KEY;
const TEMPLATE_ID = process.env.MSG91_TEMPLATE_ID;

if (!AUTH_KEY) {
  throw new Error('MSG91_AUTH_KEY is missing in environment variables');
}

if (!TEMPLATE_ID) {
  throw new Error('MSG91_TEMPLATE_ID is missing in environment variables');
}

/* =====================================================
   AXIOS CLIENT
===================================================== */

const msg91Client = axios.create({
  baseURL: 'https://control.msg91.com/api/v5',
  headers: {
    authkey: AUTH_KEY,
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

/* =====================================================
   OTP SERVICE CLASS
===================================================== */

export class OtpService {

  //////////////////////////////////////////////////////
  // GENERATE OTP
  //////////////////////////////////////////////////////

  static generateOTP(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  //////////////////////////////////////////////////////
  // STORE OTP
  //////////////////////////////////////////////////////

  static async storeOTP(mobile: string, otp: string) {

    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    await prisma.otp.create({
      data: {
        mobile,
        code: otp,
        expiresAt,
      },
    });

    return true;
  }

  //////////////////////////////////////////////////////
  // CLEAR OTP
  //////////////////////////////////////////////////////

  static async clearOTP(mobile: string) {

    await prisma.otp.deleteMany({
      where: { mobile },
    });

  }

  //////////////////////////////////////////////////////
  // SEND OTP
  //////////////////////////////////////////////////////

  static async sendOTP(mobile: string) {

    const otp = this.generateOTP();

    await this.storeOTP(mobile, otp);

    try {

      const response = await msg91Client.post('/otp', {
        mobile: `91${mobile}`,
        template_id: TEMPLATE_ID,
      });

      logger.info({
        event: 'OTP_SENT',
        mobile,
      });

      return response.data;

    } catch (error: any) {

      logger.error({
        event: 'OTP_SEND_FAILED',
        mobile,
        error: error?.response?.data || error.message,
      });

      throw new AppError('OTP sending failed', 500);
    }
  }

  //////////////////////////////////////////////////////
  // VERIFY OTP
  //////////////////////////////////////////////////////

  static async verifyOTP(mobile: string, otp: string) {

    const record = await prisma.otp.findFirst({
      where: {
        mobile,
        code: otp,
      },
    });

    if (!record) {
      throw new AppError('Invalid OTP', 400);
    }

    if (record.expiresAt < new Date()) {
      throw new AppError('OTP expired', 400);
    }

    await this.clearOTP(mobile);

    return true;
  }

}