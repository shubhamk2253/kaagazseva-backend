import { Router } from 'express';
import { SuspensionController } from './suspension.controller';
import { requireAuth, requireRole } from '../../middleware/auth.middleware';
import { UserRole } from '@prisma/client';

const router = Router();

///////////////////////////////////////////////////////////
// 1️⃣ INITIATE SUSPENSION
// District Admin / State Admin / Founder
///////////////////////////////////////////////////////////

router.post(
  '/initiate',
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
// State Admin (Level 1)
// Founder (Level 2+)
///////////////////////////////////////////////////////////

router.post(
  '/:caseId/review',
  requireAuth,
  requireRole([
    UserRole.STATE_ADMIN,
    UserRole.FOUNDER,
  ]),
  SuspensionController.review
);

///////////////////////////////////////////////////////////
// 3️⃣ APPEAL (Agent Only)
///////////////////////////////////////////////////////////

router.post(
  '/:caseId/appeal',
  requireAuth,
  requireRole([
    UserRole.AGENT,
  ]),
  SuspensionController.appeal
);

///////////////////////////////////////////////////////////
// 4️⃣ ESCALATE
// State Admin / Founder only
///////////////////////////////////////////////////////////

router.post(
  '/:caseId/escalate',
  requireAuth,
  requireRole([
    UserRole.STATE_ADMIN,
    UserRole.FOUNDER,
  ]),
  SuspensionController.escalate
);

export default router;