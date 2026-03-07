import { Router } from 'express';
import { PaymentController } from './payment.controller';
import { requireAuth } from '../../middleware/auth.middleware';
import { apiLimiter } from '../../middleware/rateLimit.middleware';
import { validate } from '../../middleware/validate.middleware';
import { paymentSchema } from './payment.schema';

const router = Router();

/**
 * KAAGAZSEVA - Payment Routes
 * Phase 5B Hardened
 */

//////////////////////////////////////////////////////
// RAZORPAY WEBHOOK (NO AUTH)
// Signature validated internally
//////////////////////////////////////////////////////

router.post(
  '/webhook',
  apiLimiter,
  PaymentController.webhookHandler
);

//////////////////////////////////////////////////////
// AUTHENTICATED ROUTES
//////////////////////////////////////////////////////

router.use(requireAuth);

//////////////////////////////////////////////////////
// CREATE ORDER
//////////////////////////////////////////////////////

router.post(
  '/create-order',
  apiLimiter,
  validate(paymentSchema.createOrder),
  PaymentController.createOrder
);

//////////////////////////////////////////////////////
// VERIFY PAYMENT (Idempotent Safe)
//////////////////////////////////////////////////////

router.post(
  '/verify',
  apiLimiter,
  validate(paymentSchema.verifyPayment),
  PaymentController.verifyPayment
);

export default router;