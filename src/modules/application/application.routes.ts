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
   PARAM VALIDATION
===================================================== */

const idParamSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid Application ID'),
  }),
});

/* =====================================================
   ALL ROUTES REQUIRE AUTH
===================================================== */

router.use(requireAuth);

////////////////////////////////////////////////////////
// 🔹 STEP 1 — CREATE DRAFT
// POST /api/v1/applications/draft
////////////////////////////////////////////////////////

router.post(
  '/draft',
  apiLimiter,
  validate(applicationSchema.createDraft),
  ApplicationController.createDraft
);

////////////////////////////////////////////////////////
// 🔹 STEP 2 — UPLOAD DOCUMENTS TO EXISTING DRAFT
// POST /api/v1/applications/:id/documents
////////////////////////////////////////////////////////

router.post(
  '/:id/documents',
  apiLimiter,
  validate(idParamSchema),
  upload.array('documents', 5),
  ApplicationController.uploadDocuments
);

////////////////////////////////////////////////////////
// 🔹 CUSTOMER DASHBOARD
// GET /api/v1/applications/me
////////////////////////////////////////////////////////

router.get(
  '/me',
  validate(applicationSchema.filter),
  ApplicationController.getMyApplications
);

////////////////////////////////////////////////////////
// 🔹 STAFF DASHBOARD LIST
// GET /api/v1/applications
////////////////////////////////////////////////////////

router.get(
  '/',
  authorizeRoles('ADMIN', 'AGENT'),
  validate(applicationSchema.filter),
  ApplicationController.listApplications
);

////////////////////////////////////////////////////////
// 🔹 SHARED DETAIL VIEW
// GET /api/v1/applications/:id
////////////////////////////////////////////////////////

router.get(
  '/:id',
  validate(idParamSchema),
  ApplicationController.getDetails
);

////////////////////////////////////////////////////////
// 🔹 STATUS UPDATE (ADMIN / AGENT)
// PATCH /api/v1/applications/:id/status
////////////////////////////////////////////////////////

router.patch(
  '/:id/status',
  apiLimiter,
  authorizeRoles('ADMIN', 'AGENT'),
  validate(applicationSchema.updateStatus),
  ApplicationController.updateStatus
);

export default router;