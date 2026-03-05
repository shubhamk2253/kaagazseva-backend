import Razorpay from 'razorpay';
import crypto from 'crypto';
import { env } from '../../config/env';
import { AppError } from '../../core/AppError';
import logger from '../../core/logger';

/**
 * KAAGAZSEVA - Razorpay Infrastructure Provider
 * Production-grade secure gateway integration
 */

export class RazorpayProvider {

  private static instance: Razorpay | null = null;

  //////////////////////////////////////////////////////
  // CONFIG VALIDATION
  //////////////////////////////////////////////////////

  private static validateConfig() {
    if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) {
      throw new AppError(
        'Payment gateway is not configured properly.',
        500
      );
    }
  }

  private static validateWebhookConfig() {
    if (!env.RAZORPAY_WEBHOOK_SECRET) {
      throw new AppError(
        'Webhook secret is not configured.',
        500
      );
    }
  }

  //////////////////////////////////////////////////////
  // SINGLETON INSTANCE
  //////////////////////////////////////////////////////

  private static getInstance(): Razorpay {

    if (!this.instance) {

      this.validateConfig();

      this.instance = new Razorpay({
        key_id: env.RAZORPAY_KEY_ID,
        key_secret: env.RAZORPAY_KEY_SECRET,
      });

      logger.info('Razorpay client initialized');
    }

    return this.instance;
  }

  //////////////////////////////////////////////////////
  // CREATE PAYMENT ORDER
  //////////////////////////////////////////////////////

  static async createOrder(
    amountInRupees: number,
    receipt: string
  ): Promise<any> {

    if (!amountInRupees || amountInRupees <= 0) {
      throw new AppError('Invalid payment amount', 400);
    }

    if (!receipt) {
      throw new AppError('Receipt reference is required', 400);
    }

    try {

      const order = await this.getInstance().orders.create({
        amount: Math.round(amountInRupees * 100),
        currency: 'INR',
        receipt,
        notes: {
          transactionId: receipt,
        },
      });

      logger.info({
        event: 'RAZORPAY_ORDER_CREATED',
        receipt,
        amount: amountInRupees,
        orderId: order.id,
      });

      return order;

    } catch (error) {

      logger.error({
        event: 'RAZORPAY_ORDER_CREATION_FAILED',
        error,
        receipt,
      });

      throw new AppError(
        'Failed to initialize payment gateway',
        500
      );

    }
  }

  //////////////////////////////////////////////////////
  // VERIFY FRONTEND SIGNATURE
  //////////////////////////////////////////////////////

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

      if (generatedSignature.length !== signature.length) {
        return false;
      }

      return crypto.timingSafeEqual(
        Buffer.from(generatedSignature),
        Buffer.from(signature)
      );

    } catch (error) {

      logger.error({
        event: 'RAZORPAY_SIGNATURE_VERIFY_FAILED',
        error,
      });

      throw new AppError(
        'Payment verification failed',
        400
      );

    }
  }

  //////////////////////////////////////////////////////
  // VERIFY WEBHOOK SIGNATURE
  //////////////////////////////////////////////////////

  static verifyWebhookSignature(
    rawBody: Buffer,
    signature: string
  ): boolean {

    if (!rawBody || !signature) {
      throw new AppError('Invalid webhook payload', 400);
    }

    this.validateWebhookConfig();

    try {

      const expectedSignature = crypto
        .createHmac('sha256', env.RAZORPAY_WEBHOOK_SECRET!)
        .update(rawBody)
        .digest('hex');

      if (expectedSignature.length !== signature.length) {
        return false;
      }

      const isValid = crypto.timingSafeEqual(
        Buffer.from(expectedSignature),
        Buffer.from(signature)
      );

      if (!isValid) {
        logger.warn({
          event: 'RAZORPAY_WEBHOOK_SIGNATURE_MISMATCH'
        });
      }

      return isValid;

    } catch (error) {

      logger.error({
        event: 'RAZORPAY_WEBHOOK_VERIFY_FAILED',
        error,
      });

      throw new AppError(
        'Webhook verification failed',
        400
      );

    }
  }
}