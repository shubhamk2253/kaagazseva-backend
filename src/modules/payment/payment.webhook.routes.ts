import { Router } from 'express';
import { PaymentWebhookController } from './payment.webhook.controller';

/**
 * KAAGAZSEVA - Razorpay Webhook Routes
 *
 * ⚠ IMPORTANT:
 * - No authentication
 * - Must receive RAW body
 * - Signature verification handled inside controller
 */

const router = Router();

//////////////////////////////////////////////////////
// RAZORPAY WEBHOOK
//////////////////////////////////////////////////////

router.post(
  '/webhook',
  PaymentWebhookController.handleWebhook
);

export default router;