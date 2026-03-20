import { redis }            from '../../config/redis';
import { AdminRepository }  from './admin.repository';
import { prisma }           from '../../config/database';
import { ApplicationStatus, KycStatus } from '@prisma/client';
import { buildPaginationMeta } from '../../core/types';
import logger               from '../../core/logger';

/**
 * KAAGAZSEVA - Dashboard Service
 * Founder-Level Business Intelligence
 * Rename matches AdminController import: DashboardService
 */

export class DashboardService {

  private static readonly CACHE_KEY = 'admin:dashboard:overview';
  private static readonly CACHE_TTL = 300; // 5 minutes

  /* =====================================================
     FOUNDER OVERVIEW — cached 5 minutes
  ===================================================== */

  static async getFounderOverview() {

    // 1. Try cache
    try {
      const cached = await redis.get(this.CACHE_KEY);
      if (cached) {
        logger.info({ event: 'ADMIN_DASHBOARD_CACHE_HIT' });
        return JSON.parse(cached);
      }
    } catch {
      logger.warn({ event: 'ADMIN_DASHBOARD_CACHE_READ_FAILED' });
    }

    // 2. Fetch all data in parallel
    const [
      summary,
      revenueStats,
      revenueTrend,
      leaderboard,
      revenueGrowth,
      refundAnalytics,
    ] = await Promise.all([
      AdminRepository.getPlatformSummary(),
      AdminRepository.getRevenueStats(),
      AdminRepository.getDailyRevenueTrend(),
      AdminRepository.getAgentLeaderboard(),
      AdminRepository.getRevenueGrowth(),
      AdminRepository.getRefundAnalytics(),
    ]);

    // 3. Format response
    // Amounts stored in Rupees directly — no /100 conversion
    const formatted = {
      users:        summary.users,
      applications: summary.applications,

      financials: {
        totalRevenue:        Number(revenueStats.totalRevenue ?? 0),
        totalTransactions:   revenueStats.totalTransactions,
        totalWalletBalance:  Number(summary.totalWalletBalance ?? 0),
        revenueGrowthPercent: revenueGrowth.growthPercent,
        refundAnalytics,
      },

      revenueTrend: revenueTrend.map((r) => ({
        date:    r.date,
        revenue: Number(r.revenue ?? 0),
      })),

      topAgents:   leaderboard,
      lastUpdated: new Date().toISOString(),
    };

    // 4. Cache result
    try {
      await redis.set(
        this.CACHE_KEY,
        JSON.stringify(formatted),
        'EX',
        this.CACHE_TTL
      );
    } catch {
      logger.warn({ event: 'ADMIN_DASHBOARD_CACHE_WRITE_FAILED' });
    }

    return formatted;
  }

  /* =====================================================
     STATE ANALYTICS
  ===================================================== */

  static async getStateAnalytics() {
    return AdminRepository.getPlatformSummary(); // extend later
  }

  /* =====================================================
     DISTRICT ANALYTICS
  ===================================================== */

  static async getDistrictAnalytics(stateId?: string) {
    const where = stateId ? { stateId } : {};

    const districts = await prisma.district.findMany({
      where,
      select: {
        id:   true,
        name: true,
        state: { select: { name: true, code: true } },
        _count: {
          select: { applications: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    return districts.map((d) => ({
      districtId:   d.id,
      districtName: d.name,
      stateName:    d.state.name,
      stateCode:    d.state.code,
      applications: d._count.applications,
    }));
  }

  /* =====================================================
     TOP AGENTS
  ===================================================== */

  static async getTopAgents(limit: number = 10) {
    return AdminRepository.getAgentLeaderboard(limit);
  }

  /* =====================================================
     REVENUE ANALYTICS BY PERIOD
  ===================================================== */

  static async getRevenueAnalytics(period: string = '30d') {
    const days = period === '7d'  ? 7
               : period === '90d' ? 90
               : period === '1y'  ? 365
               : 30;

    const from = new Date();
    from.setDate(from.getDate() - days);

    const [growth, refunds, trend] = await Promise.all([
      AdminRepository.getRevenueGrowth(),
      AdminRepository.getRefundAnalytics(),
      AdminRepository.getDailyRevenueTrend(),
    ]);

    return { period, from, growth, refunds, trend };
  }

  /* =====================================================
     APPLICATIONS WITH FILTERS
  ===================================================== */

  static async getApplications(params: {
    status?: string;
    page:    number;
    limit:   number;
  }) {
    const { status, page, limit } = params;
    const skip = (page - 1) * limit;

    const where = status
      ? { status: status as ApplicationStatus }
      : {};

    const [items, total] = await Promise.all([
      prisma.application.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id:              true,
          referenceNumber: true,
          status:          true,
          totalAmount:     true,
          createdAt:       true,
          customer: { select: { name: true, email: true } },
          agent:    { select: { name: true, email: true } },
          service:  { select: { name: true } },
        },
      }),
      prisma.application.count({ where }),
    ]);

    return { items, meta: buildPaginationMeta(page, limit, total) };
  }

  /* =====================================================
     AGENTS WITH FILTERS
  ===================================================== */

  static async getAgents(params: {
    page:       number;
    limit:      number;
    kycStatus?: string;
  }) {
    const { page, limit, kycStatus } = params;
    const skip = (page - 1) * limit;

    const where = kycStatus
      ? { agentProfile: { kycStatus: kycStatus as KycStatus } }
      : { agentProfile: { isNot: null } };

    const [items, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id:    true,
          name:  true,
          email: true,
          agentProfile: {
            select: {
              kycStatus:      true,
              isAvailable:    true,
              serviceRadiusKm: true,
            },
          },
          agentMetrics: {
            select: {
              rating:         true,
              completedCases: true,
              activeCases:    true,
            },
          },
        },
      }),
      prisma.user.count({ where }),
    ]);

    return { items, meta: buildPaginationMeta(page, limit, total) };
  }

  /* =====================================================
     MANUAL CACHE INVALIDATION
  ===================================================== */

  static async clearDashboardCache() {
    try {
      await redis.del(this.CACHE_KEY);
      logger.info({ event: 'ADMIN_DASHBOARD_CACHE_CLEARED' });
    } catch {
      logger.warn({ event: 'ADMIN_DASHBOARD_CACHE_CLEAR_FAILED' });
    }
  }
}