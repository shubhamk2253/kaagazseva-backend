import { Router } from 'express';
import { AdminController } from './admin.controller';
import { requireAuth } from '../../middleware/auth.middleware';
import { authorizeRoles } from '../../middleware/role.middleware';
import { apiLimiter } from '../../middleware/rateLimit.middleware';

/**
 * KAAGAZSEVA - Admin Routes
 * Founder-Level Governance Endpoints
 */

const router = Router();

/* =====================================================
   GLOBAL ADMIN PROTECTION
===================================================== */

router.use(requireAuth);
router.use(authorizeRoles('ADMIN'));

/* =====================================================
   DASHBOARD ANALYTICS
===================================================== */

/**
 * GET /api/v1/admin/dashboard/overview
 * National revenue + KPIs
 */
router.get(
  '/dashboard/overview',
  apiLimiter,
  AdminController.getOverview
);

/**
 * GET /api/v1/admin/dashboard/states
 * Revenue grouped by state
 */
router.get(
  '/dashboard/states',
  apiLimiter,
  AdminController.getStateAnalytics
);

/**
 * GET /api/v1/admin/dashboard/districts?state=Maharashtra
 * District analytics (optionally filtered by state)
 */
router.get(
  '/dashboard/districts',
  apiLimiter,
  AdminController.getDistrictAnalytics
);

/**
 * GET /api/v1/admin/dashboard/top-agents
 * Top performing agents
 */
router.get(
  '/dashboard/top-agents',
  apiLimiter,
  AdminController.getTopAgents
);

export default router;