import { Router } from 'express';
import { PaymentController } from './payment.controller';
import { requireAuth } from '../../middleware/auth.middleware';
import { apiLimiter } from '../../middleware/rateLimit.middleware';

const router = Router();

/**
 * All payment routes require authentication
 */
router.use(requireAuth);

//////////////////////////////////////////////////////
// CREATE ORDER
//////////////////////////////////////////////////////

router.post(
  '/create-order',
  apiLimiter,
  PaymentController.createOrder
);

//////////////////////////////////////////////////////
// VERIFY PAYMENT
//////////////////////////////////////////////////////

router.post(
  '/verify',
  apiLimiter,
  PaymentController.verifyPayment
);

export default router;