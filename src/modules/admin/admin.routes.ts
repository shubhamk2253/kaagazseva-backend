import { Router }           from 'express';
import { AdminController }  from './admin.controller';
import { requireAuthRole }  from '../../middleware/auth.middleware';
import { UserRole }         from '@prisma/client';
import { validate }         from '../../middleware/validate.middleware';
import { z }                from 'zod';

/**
 * KAAGAZSEVA - Admin Routes
 * Founder-Level Governance Endpoints
 * ALL routes protected by FOUNDER role
 */

const router = Router();

/* =====================================================
   GLOBAL PROTECTION — FOUNDER ONLY
   requireAuthRole = requireAuth + requireRole combined
===================================================== */

router.use(...requireAuthRole(UserRole.FOUNDER));

/* =====================================================
   DASHBOARD ANALYTICS
===================================================== */

// GET /api/v1/admin/dashboard/overview
router.get('/dashboard/overview', AdminController.getOverview);

// GET /api/v1/admin/dashboard/states
router.get('/dashboard/states', AdminController.getStateAnalytics);

// GET /api/v1/admin/dashboard/districts?stateId=uuid
router.get(
  '/dashboard/districts',
  validate({
    query: z.object({
      stateId: z.string().uuid().optional(),
    }),
  }),
  AdminController.getDistrictAnalytics
);

// GET /api/v1/admin/dashboard/top-agents?limit=10
router.get(
  '/dashboard/top-agents',
  validate({
    query: z.object({
      limit: z.coerce.number().min(1).max(50).default(10),
    }),
  }),
  AdminController.getTopAgents
);

// GET /api/v1/admin/dashboard/revenue?period=30d
router.get(
  '/dashboard/revenue',
  validate({
    query: z.object({
      period: z.enum(['7d', '30d', '90d', '1y']).default('30d'),
    }),
  }),
  AdminController.getRevenueAnalytics
);

/* =====================================================
   OPERATIONAL MONITORING
===================================================== */

// GET /api/v1/admin/applications?status=DISPUTED&page=1
router.get(
  '/applications',
  validate({
    query: z.object({
      status: z.string().optional(),
      page:   z.coerce.number().default(1),
      limit:  z.coerce.number().max(100).default(20),
    }),
  }),
  AdminController.getApplications
);

// GET /api/v1/admin/agents?kycStatus=PENDING&page=1
router.get(
  '/agents',
  validate({
    query: z.object({
      kycStatus: z.string().optional(),
      page:      z.coerce.number().default(1),
      limit:     z.coerce.number().max(100).default(20),
    }),
  }),
  AdminController.getAgents
);

export default router;