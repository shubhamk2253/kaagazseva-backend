import { Router } from 'express';
import { ApplicationController } from './application.controller';
import { applicationSchema } from './application.schema';
import { validate } from '../../middleware/validate.middleware';
import { requireAuth } from '../../middleware/auth.middleware';
import { authorizeRoles } from '../../middleware/role.middleware';
import { apiLimiter } from '../../middleware/rateLimit.middleware';
import { upload } from '../../middleware/upload.middleware';
import { z } from 'zod';

const router = Router();

/* =====================================================
   Dedicated ID Param Validation
===================================================== */
const idParamSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid Application ID'),
  }),
});

/* =====================================================
   All application routes require authentication
===================================================== */
router.use(requireAuth);

/* =====================================================
   CITIZEN ROUTES
===================================================== */

/**
 * POST /api/v1/applications
 * Upload documents + create application
 */
router.post(
  '/',
  apiLimiter,
  upload.array('documents', 5), // max 5 files
  ApplicationController.apply
);

/**
 * GET /api/v1/applications/me
 */
router.get(
  '/me',
  validate(applicationSchema.filter),
  ApplicationController.getMyApplications
);

/* =====================================================
   STAFF DASHBOARD ROUTE
===================================================== */

/**
 * GET /api/v1/applications
 * Admin / Agent listing
 */
router.get(
  '/',
  authorizeRoles('ADMIN', 'AGENT'),
  validate(applicationSchema.filter),
  ApplicationController.listApplications
);

/* =====================================================
   SHARED ROUTES
===================================================== */

/**
 * GET /api/v1/applications/:id
 */
router.get(
  '/:id',
  validate(idParamSchema),
  ApplicationController.getDetails
);

/* =====================================================
   STAFF STATUS UPDATE
===================================================== */

/**
 * PATCH /api/v1/applications/:id/status
 */
router.patch(
  '/:id/status',
  apiLimiter,
  authorizeRoles('ADMIN', 'AGENT'),
  validate(applicationSchema.updateStatus),
  ApplicationController.updateStatus
);

export default router;