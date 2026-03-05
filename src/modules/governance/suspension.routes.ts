import { Router } from 'express';
import { SuspensionController } from './suspension.controller';
import { requireAuth, requireRole } from '../../middleware/auth.middleware';
import { apiLimiter } from '../../middleware/rateLimit.middleware';
import { UserRole } from '@prisma/client';

const router = Router();

///////////////////////////////////////////////////////////
// 1️⃣ INITIATE SUSPENSION
///////////////////////////////////////////////////////////

router.post(
  '/initiate',
  apiLimiter,
  requireAuth,
  requireRole([
    UserRole.DISTRICT_ADMIN,
    UserRole.STATE_ADMIN,
    UserRole.FOUNDER,
  ]),
  SuspensionController.initiate
);

///////////////////////////////////////////////////////////
// 2️⃣ REVIEW SUSPENSION
///////////////////////////////////////////////////////////

router.post(
  '/:caseId/review',
  apiLimiter,
  requireAuth,
  requireRole([
    UserRole.STATE_ADMIN,
    UserRole.FOUNDER,
  ]),
  SuspensionController.review
);

///////////////////////////////////////////////////////////
// 3️⃣ APPEAL
///////////////////////////////////////////////////////////

router.post(
  '/:caseId/appeal',
  apiLimiter,
  requireAuth,
  requireRole([
    UserRole.AGENT,
  ]),
  SuspensionController.appeal
);

///////////////////////////////////////////////////////////
// 4️⃣ ESCALATE
///////////////////////////////////////////////////////////

router.post(
  '/:caseId/escalate',
  apiLimiter,
  requireAuth,
  requireRole([
    UserRole.STATE_ADMIN,
    UserRole.FOUNDER,
  ]),
  SuspensionController.escalate
);

export default router;