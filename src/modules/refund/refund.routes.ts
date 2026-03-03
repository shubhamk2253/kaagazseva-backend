import { Router } from 'express';
import { RefundController } from './refund.controller';
import { requireAuth, requireRole } from '../../middleware/auth.middleware';
import { UserRole } from '@prisma/client';

const router = Router();

/**
 * All refund routes require authentication
 */
router.use(requireAuth);

//////////////////////////////////////////////////////
// CUSTOMER REQUEST
//////////////////////////////////////////////////////

router.post(
  '/request',
  requireRole([UserRole.CUSTOMER]),
  RefundController.requestRefund
);

//////////////////////////////////////////////////////
// ADMIN REVIEW
//////////////////////////////////////////////////////

router.post(
  '/:id/review',
  requireRole([UserRole.STATE_ADMIN, UserRole.FOUNDER]),
  RefundController.reviewRefund
);

//////////////////////////////////////////////////////
// PROCESS APPROVED REFUND
//////////////////////////////////////////////////////

router.post(
  '/:id/process',
  requireRole([UserRole.STATE_ADMIN, UserRole.FOUNDER]),
  RefundController.processRefund
);

export default router;