import { Request, Response } from 'express';
import { RazorpayProvider } from './razorpay.provider';
import { PaymentService } from './payment.service';
import logger from '../../core/logger';

/**
 * Razorpay Webhook Controller
 */

export class PaymentWebhookController {

  static async handleWebhook(req: Request, res: Response) {

    try {

      const signature = req.headers['x-razorpay-signature'] as string;

      if (!signature) {
        return res.status(400).json({
          success: false,
          message: 'Missing Razorpay signature',
        });
      }

      //////////////////////////////////////////////////////
      // VERIFY WEBHOOK SIGNATURE
      //////////////////////////////////////////////////////

      const isValid = RazorpayProvider.verifyWebhookSignature(
        req.body as Buffer,
        signature
      );

      if (!isValid) {
        logger.warn('Invalid Razorpay webhook signature');
        return res.status(400).json({
          success: false,
          message: 'Invalid webhook signature',
        });
      }

      //////////////////////////////////////////////////////
      // PARSE EVENT BODY
      //////////////////////////////////////////////////////

      const eventBody = JSON.parse((req.body as Buffer).toString());
      const eventType = eventBody?.event;

      if (!eventType) {
        logger.warn('Webhook missing event type');
        return res.status(200).json({ received: true });
      }

      //////////////////////////////////////////////////////
      // PAYMENT CAPTURED
      //////////////////////////////////////////////////////

      if (eventType === 'payment.captured') {

        const payment = eventBody?.payload?.payment?.entity;

        if (!payment) {
          logger.warn('Webhook missing payment entity');
          return res.status(200).json({ received: true });
        }

        const orderId = payment.order_id;
        const paymentId = payment.id;
        const transactionId = payment.notes?.transactionId;

        if (!transactionId) {
          logger.warn({
            event: 'WEBHOOK_MISSING_TRANSACTION_ID',
            paymentId,
          });

          return res.status(200).json({ received: true });
        }

        //////////////////////////////////////////////////////
        // VERIFY PAYMENT VIA SERVICE
        //////////////////////////////////////////////////////

        await PaymentService.verifyPayment(
          orderId,
          paymentId,
          'webhook',
          transactionId
        );

        logger.info({
          event: 'WEBHOOK_PAYMENT_CAPTURED',
          transactionId,
          paymentId,
          orderId,
        });

      }

      //////////////////////////////////////////////////////
      // PAYMENT FAILED
      //////////////////////////////////////////////////////

      if (eventType === 'payment.failed') {

        const payment = eventBody?.payload?.payment?.entity;

        logger.warn({
          event: 'WEBHOOK_PAYMENT_FAILED',
          paymentId: payment?.id,
          orderId: payment?.order_id,
        });

      }

      //////////////////////////////////////////////////////
      // SUCCESS RESPONSE
      //////////////////////////////////////////////////////

      return res.status(200).json({ received: true });

    } catch (error) {

      logger.error({
        event: 'WEBHOOK_PROCESSING_FAILED',
        error,
      });

      return res.status(500).json({
        success: false,
        message: 'Webhook processing error',
      });

    }

  }

}