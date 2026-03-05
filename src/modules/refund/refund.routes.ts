import { Router } from 'express';
import { RefundController } from './refund.controller';
import { requireAuth, requireRole } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validate.middleware';
import { apiLimiter } from '../../middleware/rateLimit.middleware';
import {
  refundRequestSchema,
  refundReviewSchema,
  refundProcessSchema
} from './refund.schema';
import { UserRole } from '@prisma/client';

const router = Router();

/**
 * KAAGAZSEVA - Refund Routes
 * Phase 5B Financial Governance
 */

// All refund routes require authentication
router.use(requireAuth);

//////////////////////////////////////////////////////
// CUSTOMER REQUEST REFUND
//////////////////////////////////////////////////////

router.post(
  '/request',
  apiLimiter,
  requireRole([UserRole.CUSTOMER]),
  validate(refundRequestSchema),
  RefundController.requestRefund
);

//////////////////////////////////////////////////////
// STATE_ADMIN / FOUNDER REVIEW
//////////////////////////////////////////////////////

router.post(
  '/:id/review',
  apiLimiter,
  requireRole([UserRole.STATE_ADMIN, UserRole.FOUNDER]),
  validate(refundReviewSchema),
  RefundController.reviewRefund
);

//////////////////////////////////////////////////////
// PROCESS APPROVED REFUND
//////////////////////////////////////////////////////

router.post(
  '/:id/process',
  apiLimiter,
  requireRole([UserRole.STATE_ADMIN, UserRole.FOUNDER]),
  validate(refundProcessSchema),
  RefundController.processRefund
);

export default router;