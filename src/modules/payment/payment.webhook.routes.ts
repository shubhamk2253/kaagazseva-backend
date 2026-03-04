import { Router } from 'express';
import { PaymentWebhookController } from './payment.webhook.controller';

const router = Router();

/**
 * Razorpay Webhook Route
 * No authentication required
 */

router.post(
  '/webhook',
  PaymentWebhookController.handleWebhook
);

export default router;