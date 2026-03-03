import Razorpay from 'razorpay';
import crypto from 'crypto';
import { env } from '../../config/env';
import { AppError } from '../../core/AppError';
import logger from '../../core/logger';

/**
 * KAAGAZSEVA - Razorpay Infrastructure Provider
 * Secure singleton-based payment gateway integration.
 */
export class RazorpayProvider {
  private static instance: Razorpay | null = null;

  /* =====================================================
     CONFIG VALIDATION
  ===================================================== */
  private static validateConfig() {
    if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) {
      throw new AppError(
        'Payment gateway is not configured properly.',
        500
      );
    }
  }

  /* =====================================================
     SINGLETON INSTANCE
  ===================================================== */
  private static getInstance(): Razorpay {
    if (!this.instance) {
      this.validateConfig();

      this.instance = new Razorpay({
        key_id: env.RAZORPAY_KEY_ID,
        key_secret: env.RAZORPAY_KEY_SECRET,
      });
    }

    return this.instance;
  }

  /* =====================================================
     CREATE ORDER
  ===================================================== */
  static async createOrder(
    amountInRupees: number,
    receipt: string
  ): Promise<any> {   // ✅ FIXED: removed Razorpay.Order type
    if (!amountInRupees || amountInRupees <= 0) {
      throw new AppError('Invalid payment amount', 400);
    }

    if (!receipt) {
      throw new AppError('Receipt reference is required', 400);
    }

    try {
      const order = await this.getInstance().orders.create({
        amount: Math.round(amountInRupees * 100), // INR → Paisa
        currency: 'INR',
        receipt,
      });

      logger.info(
        `Payment Order Created → receipt=${receipt} | amount=${amountInRupees}`
      );

      return order;

    } catch (error) {
      logger.error(`Razorpay Order Creation Error → ${error}`);
      throw new AppError('Failed to initialize payment gateway', 500);
    }
  }

  /* =====================================================
     VERIFY SIGNATURE
  ===================================================== */
  static verifySignature(
    orderId: string,
    paymentId: string,
    signature: string
  ): boolean {
    if (!orderId || !paymentId || !signature) {
      throw new AppError(
        'Payment verification failed: Missing parameters',
        400
      );
    }

    try {
      const generatedSignature = crypto
        .createHmac('sha256', env.RAZORPAY_KEY_SECRET!)
        .update(`${orderId}|${paymentId}`)
        .digest('hex');

      const isValid = crypto.timingSafeEqual(
        Buffer.from(generatedSignature),
        Buffer.from(signature)
      );

      if (!isValid) {
        logger.warn(`Payment Signature Mismatch → orderId=${orderId}`);
      }

      return isValid;

    } catch (error) {
      logger.error(`Razorpay Signature Verification Error → ${error}`);
      throw new AppError('Payment verification failed', 400);
    }
  }
}