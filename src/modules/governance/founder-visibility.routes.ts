import { Router } from 'express';
import { requireAuth, requireRole } from '../../middleware/auth.middleware';
import { UserRole } from '@prisma/client';
import { FounderVisibilityController } from './founder-visibility.controller';

const router = Router();

router.get(
  '/overview',
  requireAuth,
  requireRole([UserRole.FOUNDER]),
  FounderVisibilityController.overview
);

export default router;