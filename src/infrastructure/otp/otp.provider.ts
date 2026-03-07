import axios from "axios";
import logger from "../../core/logger";

export class OtpProvider {

  //////////////////////////////////////////////////////
  // SEND OTP USING MSG91 DEFAULT OTP SERVICE
  //////////////////////////////////////////////////////

  static async sendOTP(phoneNumber: string) {

    try {

      const response = await axios.get(
        `https://control.msg91.com/api/v5/otp?authkey=${process.env.MSG91_AUTH_KEY}&mobile=91${phoneNumber}&otp_length=6`
      );

      return response.data;

    } catch (error: any) {

      logger.error({
        event: "MSG91_OTP_FAILED",
        error: error?.response?.data || error.message
      });

      throw new Error("Unable to send verification code");

    }

  }

}