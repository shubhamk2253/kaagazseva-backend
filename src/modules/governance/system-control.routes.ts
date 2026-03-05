import { Router } from 'express';
import { requireAuth, requireRole } from '../../middleware/auth.middleware';
import { apiLimiter } from '../../middleware/rateLimit.middleware';
import { UserRole } from '@prisma/client';
import { SystemControlController } from './system-control.controller';

/**
 * KAAGAZSEVA - System Control Routes
 * Founder Emergency Financial Controls
 */

const router = Router();

//////////////////////////////////////////////////////
// GLOBAL SECURITY
//////////////////////////////////////////////////////

router.use(requireAuth);
router.use(requireRole([UserRole.FOUNDER]));

//////////////////////////////////////////////////////
// GET SYSTEM STATUS
//////////////////////////////////////////////////////

router.get(
  '/system-status',
  apiLimiter,
  SystemControlController.getStatus
);

//////////////////////////////////////////////////////
// FREEZE PAYMENTS
//////////////////////////////////////////////////////

router.post(
  '/freeze/payments',
  apiLimiter,
  SystemControlController.freezePayments
);

//////////////////////////////////////////////////////
// FREEZE REFUNDS
//////////////////////////////////////////////////////

router.post(
  '/freeze/refunds',
  apiLimiter,
  SystemControlController.freezeRefunds
);

//////////////////////////////////////////////////////
// FREEZE WITHDRAWALS
//////////////////////////////////////////////////////

router.post(
  '/freeze/withdrawals',
  apiLimiter,
  SystemControlController.freezeWithdrawals
);

//////////////////////////////////////////////////////
// UNFREEZE SYSTEM
//////////////////////////////////////////////////////

router.post(
  '/unfreeze',
  apiLimiter,
  SystemControlController.unfreezeSystem
);

export default router;