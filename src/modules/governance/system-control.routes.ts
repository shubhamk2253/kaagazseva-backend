import { Router } from 'express';
import { requireAuth, requireRole } from '../../middleware/auth.middleware';
import { UserRole } from '@prisma/client';
import { SystemControlController } from './system-control.controller';

/**
 * KAAGAZSEVA - System Control Routes
 * Founder Emergency Financial Controls
 */

const router = Router();

//////////////////////////////////////////////////////
// GET SYSTEM STATUS
//////////////////////////////////////////////////////

router.get(
  '/system-status',
  requireAuth,
  requireRole([UserRole.FOUNDER]),
  SystemControlController.getStatus
);

//////////////////////////////////////////////////////
// FREEZE PAYMENTS
//////////////////////////////////////////////////////

router.post(
  '/freeze/payments',
  requireAuth,
  requireRole([UserRole.FOUNDER]),
  SystemControlController.freezePayments
);

//////////////////////////////////////////////////////
// FREEZE REFUNDS
//////////////////////////////////////////////////////

router.post(
  '/freeze/refunds',
  requireAuth,
  requireRole([UserRole.FOUNDER]),
  SystemControlController.freezeRefunds
);

//////////////////////////////////////////////////////
// FREEZE WITHDRAWALS
//////////////////////////////////////////////////////

router.post(
  '/freeze/withdrawals',
  requireAuth,
  requireRole([UserRole.FOUNDER]),
  SystemControlController.freezeWithdrawals
);

//////////////////////////////////////////////////////
// UNFREEZE SYSTEM
//////////////////////////////////////////////////////

router.post(
  '/unfreeze',
  requireAuth,
  requireRole([UserRole.FOUNDER]),
  SystemControlController.unfreezeSystem
);

export default router;