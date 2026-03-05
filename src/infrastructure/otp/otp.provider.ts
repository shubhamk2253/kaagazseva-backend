import axios from 'axios';
import { env } from '../../config/env';
import logger from '../../core/logger';
import { AppError } from '../../core/AppError';

/**
 * KAAGAZSEVA - OTP Provider
 * Secure bridge to external SMS gateway.
 */

export class OtpProvider {

  /* =====================================================
     PHONE MASKING
  ===================================================== */

  private static maskPhone(phone: string): string {
    const last4 = phone.slice(-4);
    return `******${last4}`;
  }

  /* =====================================================
     SEND OTP SMS
  ===================================================== */

  static async sendSms(phoneNumber: string, otp: string): Promise<void> {

    const maskedPhone = this.maskPhone(phoneNumber);

    const message =
      `Your KaagazSeva verification code is: ${otp}. Valid for 5 minutes.`;

    try {

      //////////////////////////////////////////////////////
      // DEVELOPMENT MODE
      //////////////////////////////////////////////////////

      if (env.NODE_ENV === 'development') {

        logger.info({
          event: 'DEV_SMS_OTP',
          phone: maskedPhone,
        });

        // Developer convenience
        console.log(`📲 DEV OTP for ${maskedPhone}: ${otp}`);

        return;
      }

      //////////////////////////////////////////////////////
      // VALIDATE SMS CONFIG
      //////////////////////////////////////////////////////

      if (!env.SMS_GATEWAY_KEY || !env.SMS_GATEWAY_URL) {
        throw new Error('SMS gateway configuration missing');
      }

      //////////////////////////////////////////////////////
      // SEND SMS
      //////////////////////////////////////////////////////

      await axios.post(
        env.SMS_GATEWAY_URL,
        {
          to: phoneNumber,
          message,
          apiKey: env.SMS_GATEWAY_KEY,
        },
        {
          timeout: 5000,
        }
      );

      logger.info({
        event: 'SMS_SENT',
        phone: maskedPhone,
      });

    } catch (error: any) {

      logger.error({
        event: 'SMS_SEND_FAILED',
        phone: maskedPhone,
        error: error.message,
      });

      throw new AppError(
        'Unable to send verification code. Please try again.',
        500,
        true,
        'OTP_SEND_FAILED'
      );
    }
  }
}