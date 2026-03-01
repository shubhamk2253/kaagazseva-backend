import { Response } from 'express';
import { DashboardService } from './dashboard.service';
import { asyncHandler } from '../../core/asyncHandler';
import { ApiResponse } from '../../core/ApiResponse';
import { RequestWithUser } from '../../core/types';

/**
 * KAAGAZSEVA - Admin Controller
 * Founder-Level Analytics Layer
 */
export class AdminController {

  //////////////////////////////////////////////////////
  // 📊 NATIONAL OVERVIEW
  // GET /api/v1/admin/dashboard/overview
  //////////////////////////////////////////////////////

  static getOverview = asyncHandler(
    async (_req: RequestWithUser, res: Response) => {

      const stats = await DashboardService.getFounderOverview();

      return ApiResponse.success(
        res,
        'Founder dashboard overview retrieved',
        stats
      );
    }
  );

  //////////////////////////////////////////////////////
  // 🌍 STATE ANALYTICS
  // GET /api/v1/admin/dashboard/states
  //////////////////////////////////////////////////////

  static getStateAnalytics = asyncHandler(
    async (_req: RequestWithUser, res: Response) => {

      const data = await DashboardService.getStateAnalytics();

      return ApiResponse.success(
        res,
        'State analytics retrieved successfully',
        data
      );
    }
  );

  //////////////////////////////////////////////////////
  // 🏘 DISTRICT ANALYTICS
  // GET /api/v1/admin/dashboard/districts?state=Maharashtra
  //////////////////////////////////////////////////////

  static getDistrictAnalytics = asyncHandler(
    async (req: RequestWithUser, res: Response) => {

      const { state } = req.query;

      const data = await DashboardService.getDistrictAnalytics(
        state as string | undefined
      );

      return ApiResponse.success(
        res,
        'District analytics retrieved successfully',
        data
      );
    }
  );

  //////////////////////////////////////////////////////
  // 🏆 TOP AGENTS
  // GET /api/v1/admin/dashboard/top-agents
  //////////////////////////////////////////////////////

  static getTopAgents = asyncHandler(
    async (_req: RequestWithUser, res: Response) => {

      const data = await DashboardService.getTopAgents(10);

      return ApiResponse.success(
        res,
        'Top agents retrieved successfully',
        data
      );
    }
  );

}