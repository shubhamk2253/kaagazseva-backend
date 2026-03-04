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
        return res.status(400).json({
          success: false,
          message: 'Invalid webhook signature',
        });
      }

      //////////////////////////////////////////////////////
      // PARSE EVENT
      //////////////////////////////////////////////////////

      const eventBody = JSON.parse(req.body.toString());
      const event = eventBody.event;

      //////////////////////////////////////////////////////
      // PAYMENT CAPTURED
      //////////////////////////////////////////////////////

      if (event === 'payment.captured') {

        const payment = eventBody.payload.payment.entity;

        const orderId = payment.order_id;
        const paymentId = payment.id;

        const transactionId = payment.notes?.transactionId;

        if (!transactionId) {
          logger.warn('Webhook missing transactionId');
          return res.status(200).json({ received: true });
        }

        await PaymentService.verifyPayment(
          orderId,
          paymentId,
          'webhook',
          transactionId
        );

        logger.info(`Webhook payment processed → ${transactionId}`);
      }

      //////////////////////////////////////////////////////
      // PAYMENT FAILED
      //////////////////////////////////////////////////////

      if (event === 'payment.failed') {

        const payment = eventBody.payload.payment.entity;

        logger.warn(`Payment failed → ${payment.id}`);
      }

      return res.status(200).json({ received: true });

    } catch (error) {

      logger.error('Webhook processing failed', error);

      return res.status(500).json({
        success: false,
        message: 'Webhook processing error',
      });

    }
  }
}