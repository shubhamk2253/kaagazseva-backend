import { Router }                  from 'express';
import { ApplicationController }   from './application.controller';
import { applicationSchema }       from './application.schema';
import { validate }                from '../../middleware/validate.middleware';
import { requireAuth, requireRole } from '../../middleware/auth.middleware';
import {
  uploadMultiple,
  uploadProof,
}                                  from '../../middleware/upload.middleware';
import { UserRole }                from '@prisma/client';
import { z }                       from 'zod';

/**
 * KAAGAZSEVA - Application Routes
 * Base: /api/v1/applications
 */

const router = Router();

/* =====================================================
   SHARED PARAM SCHEMA
===================================================== */

const idParam = z.object({
  params: z.object({
    id: z.string().uuid('Invalid application ID'),
  }),
});

/* =====================================================
   ALL ROUTES REQUIRE AUTH
===================================================== */

router.use(requireAuth);

/* =====================================================
   CUSTOMER ROUTES
===================================================== */

// POST /api/v1/applications
// Create application draft
router.post(
  '/',
  validate(applicationSchema.createDraft),
  ApplicationController.createDraft
);

// POST /api/v1/applications/:id/documents
// Upload documents to draft
router.post(
  '/:id/documents',
  validate(idParam),
  uploadMultiple,
  ApplicationController.uploadDocuments
);

// POST /api/v1/applications/:id/confirm
// Customer confirms service completion → releases payout
router.post(
  '/:id/confirm',
  validate(idParam),
  ApplicationController.confirmCompletion
);

// POST /api/v1/applications/:id/cancel
// Cancel application
router.post(
  '/:id/cancel',
  validate({
    ...idParam,
    body: z.object({
      reason: z.string().min(10, 'Please provide a reason'),
    }),
  }),
  ApplicationController.cancel
);

// GET /api/v1/applications/my
// Customer's own applications
router.get(
  '/my',
  validate({ query: applicationSchema.filter }),
  ApplicationController.getMyApplications
);

// GET /api/v1/applications/:id
// Application detail (customer sees own, staff sees all)
router.get(
  '/:id',
  validate(idParam),
  ApplicationController.getDetails
);

/* =====================================================
   STAFF ROUTES — Agent + Admin
===================================================== */

// GET /api/v1/applications
// Full application list with filters
router.get(
  '/',
  requireRole([UserRole.STATE_ADMIN, UserRole.DISTRICT_ADMIN,
               UserRole.FOUNDER,     UserRole.AGENT]),
  validate({ query: applicationSchema.filter }),
  ApplicationController.listApplications
);

// PATCH /api/v1/applications/:id/status
// Update application status
router.patch(
  '/:id/status',
  requireRole([UserRole.STATE_ADMIN, UserRole.DISTRICT_ADMIN,
               UserRole.FOUNDER,     UserRole.AGENT]),
  validate(applicationSchema.updateStatus),
  ApplicationController.updateStatus
);

/* =====================================================
   AGENT ROUTES — Completion proof upload
===================================================== */

// POST /api/v1/applications/:id/proof
// Agent uploads completion proof
router.post(
  '/:id/proof',
  requireRole([UserRole.AGENT]),
  validate(idParam),
  uploadProof,
  ApplicationController.uploadDocuments
);

export default router;