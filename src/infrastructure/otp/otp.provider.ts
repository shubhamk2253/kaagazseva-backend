import axios from 'axios';
import { env } from '../../config/env';
import logger from '../../core/logger';
import { AppError } from '../../core/AppError';

/**
 * KAAGAZSEVA - OTP Provider
 * Secure bridge to external SMS gateway.
 * Designed for easy provider replacement.
 */
export class OtpProvider {
  /**
   * Masks phone number for safe logging
   */
  private static maskPhone(phone: string): string {
    const last4 = phone.slice(-4);
    return `******${last4}`;
  }

  /**
   * Sends OTP SMS
   */
  static async sendSms(phoneNumber: string, otp: string): Promise<void> {
    const message = `Your KaagazSeva verification code is: ${otp}. Valid for 5 minutes.`;

    const maskedPhone = this.maskPhone(phoneNumber);

    try {
      /**
       * DEVELOPMENT MODE
       * We log OTP instead of sending SMS to avoid costs.
       */
      if (env.NODE_ENV === 'development') {
        logger.info(`[DEV-SMS] → ${maskedPhone} | OTP: ${otp}`);
        return;
      }

      /**
       * PRODUCTION MODE
       * Replace this with actual provider logic
       */
      await axios.post(
        'https://api.sms-provider.com/send',
        {
          to: phoneNumber,
          message,
          apiKey: process.env.SMS_GATEWAY_KEY,
        },
        {
          timeout: 5000, // Prevent hanging requests
        }
      );

      logger.info(`SMS sent successfully → ${maskedPhone}`);
    } catch (error: any) {
      logger.error(`SMS sending failed → ${maskedPhone}: ${error.message}`);

      throw new AppError(
        'Unable to send verification code. Please try again.',
        500
      );
    }
  }
}