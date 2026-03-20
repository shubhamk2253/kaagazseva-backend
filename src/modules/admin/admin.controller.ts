import { Response }          from 'express';
import { DashboardService }  from './dashboard.service';
import { asyncHandler }      from '../../core/asyncHandler';
import { ApiResponse }       from '../../core/ApiResponse';
import { RequestWithUser }   from '../../core/types';
import { PAGINATION }        from '../../core/constants';

/**
 * KAAGAZSEVA - Admin Controller
 * Founder-Level Analytics & Operations
 * All routes protected by requireAuthRole(UserRole.FOUNDER)
 */

export class AdminController {

  /* =====================================================
     GET /api/v1/admin/dashboard/overview
     National platform summary
  ===================================================== */

  static getOverview = asyncHandler(
    async (_req: RequestWithUser, res: Response) => {
      const stats = await DashboardService.getFounderOverview();
      return ApiResponse.success(res, 'Dashboard overview retrieved', stats);
    }
  );

  /* =====================================================
     GET /api/v1/admin/dashboard/states
     Per-state analytics breakdown
  ===================================================== */

  static getStateAnalytics = asyncHandler(
    async (_req: RequestWithUser, res: Response) => {
      const data = await DashboardService.getStateAnalytics();
      return ApiResponse.success(res, 'State analytics retrieved', data);
    }
  );

  /* =====================================================
     GET /api/v1/admin/dashboard/districts?stateId=uuid
     Per-district analytics filtered by state
  ===================================================== */

  static getDistrictAnalytics = asyncHandler(
    async (req: RequestWithUser, res: Response) => {
      const { stateId } = req.query as { stateId?: string };
      const data = await DashboardService.getDistrictAnalytics(stateId);
      return ApiResponse.success(res, 'District analytics retrieved', data);
    }
  );

  /* =====================================================
     GET /api/v1/admin/dashboard/top-agents?limit=10
     Top performing agents nationally
  ===================================================== */

  static getTopAgents = asyncHandler(
    async (req: RequestWithUser, res: Response) => {
      const limit = Math.min(
        Number(req.query.limit) || 10,
        PAGINATION.MAX_LIMIT
      );
      const data = await DashboardService.getTopAgents(limit);
      return ApiResponse.success(res, 'Top agents retrieved', data);
    }
  );

  /* =====================================================
     GET /api/v1/admin/dashboard/revenue?period=30d
     Revenue analytics by period
  ===================================================== */

  static getRevenueAnalytics = asyncHandler(
    async (req: RequestWithUser, res: Response) => {
      const { period } = req.query as { period?: string };
      const data = await DashboardService.getRevenueAnalytics(period || '30d');
      return ApiResponse.success(res, 'Revenue analytics retrieved', data);
    }
  );

  /* =====================================================
     GET /api/v1/admin/applications?status=DISPUTED&page=1
     Application monitoring with filters
  ===================================================== */

  static getApplications = asyncHandler(
    async (req: RequestWithUser, res: Response) => {
      const {
        status,
        page  = '1',
        limit = '20',
      } = req.query as Record<string, string>;

      const data = await DashboardService.getApplications({
        status,
        page:  Number(page),
        limit: Number(limit),
      });

      return ApiResponse.paginated(
        res,
        'Applications retrieved',
        data.items,
        data.meta
      );
    }
  );

  /* =====================================================
     GET /api/v1/admin/agents?page=1
     Agent management list
  ===================================================== */

  static getAgents = asyncHandler(
    async (req: RequestWithUser, res: Response) => {
      const {
        page  = '1',
        limit = '20',
        kycStatus,
      } = req.query as Record<string, string>;

      const data = await DashboardService.getAgents({
        page:      Number(page),
        limit:     Number(limit),
        kycStatus,
      });

      return ApiResponse.paginated(
        res,
        'Agents retrieved',
        data.items,
        data.meta
      );
    }
  );
}