import { Router } from 'express';
import { requireAuth, requireRole } from '../../middleware/auth.middleware';
import { apiLimiter } from '../../middleware/rateLimit.middleware';
import { UserRole } from '@prisma/client';
import { FounderVisibilityController } from './founder-visibility.controller';

const router = Router();

/**
 * Founder System Overview
 */
router.get(
  '/overview',
  apiLimiter,
  requireAuth,
  requireRole([UserRole.FOUNDER]),
  FounderVisibilityController.overview
);

export default router;