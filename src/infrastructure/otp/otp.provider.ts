import axios from 'axios';
import logger from '../../core/logger';

export class OtpProvider {

  //////////////////////////////////////////////////////
  // SEND OTP USING MSG91
  //////////////////////////////////////////////////////

  static async sendSms(phoneNumber: string, otp: string) {

    try {

      const url =
        `https://control.msg91.com/api/v5/otp?authkey=${process.env.MSG91_AUTH_KEY}&mobile=91${phoneNumber}&otp=${otp}&otp_length=6`;

      const response = await axios.get(url);

      logger.info({
        event: 'OTP_SENT',
        phoneNumber
      });

      return response.data;

    } catch (error: any) {

      logger.error({
        event: 'MSG91_OTP_FAILED',
        phoneNumber,
        error: error?.response?.data || error.message
      });

      throw new Error('Unable to send verification code');

    }

  }

}