import { redis } from '../../config/redis';
import { AdminRepository } from './admin.repository';
import logger from '../../core/logger';

/**
 * KAAGAZSEVA - Admin Service
 * Founder-Level Business Intelligence Layer
 */

export class AdminService {
  private static readonly DASHBOARD_CACHE_KEY = 'admin:dashboard:overview';
  private static readonly CACHE_TTL_SECONDS = 300; // 5 minutes

  /* =====================================================
     Dashboard Overview (Founder Analytics Engine)
  ===================================================== */
  static async getDashboardOverview() {
    /* ---------- 1️⃣ Check Cache ---------- */
    try {
      const cached = await redis.get(this.DASHBOARD_CACHE_KEY);
      if (cached) {
        logger.info('Admin dashboard served from cache');
        return JSON.parse(cached);
      }
    } catch {
      logger.warn('Redis read failed for dashboard cache');
    }

    /* ---------- 2️⃣ Fetch Fresh Data ---------- */
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

    /* ---------- 3️⃣ Safe Numeric Conversions ---------- */

    const totalRevenue = Number(revenueStats.totalRevenue ?? 0);
    const totalWalletBalance = Number(summary.totalWalletBalance ?? 0);

    /* ---------- 4️⃣ Format Founder Response ---------- */

    const formatted = {
      users: summary.users,

      applications: summary.applications,

      financials: {
        totalRevenue,
        totalRevenueInRupees: totalRevenue / 100,

        totalTransactions: revenueStats.totalTransactions,

        totalWalletBalance,
        totalWalletBalanceInRupees: totalWalletBalance / 100,

        /* 🔥 Founder Metrics */
        revenueGrowthPercent: revenueGrowth.growthPercent,

        refundAnalytics: {
          refundRatioPercent: refundAnalytics.refundRatioPercent,
          revenueLast30Days: refundAnalytics.revenueLast30Days,
          refundsLast30Days: refundAnalytics.refundsLast30Days,
          riskLevel: refundAnalytics.riskLevel,
        },
      },

      revenueTrend: revenueTrend.map((r: { date: string; revenue: number }) => {
        const revenue = Number(r.revenue ?? 0);

        return {
          ...r,
          revenue,
          revenueInRupees: revenue / 100,
        };
      }),

      topAgents: leaderboard,

      lastUpdated: new Date().toISOString(),
    };

    /* ---------- 5️⃣ Cache Result ---------- */
    try {
      await redis.set(
        this.DASHBOARD_CACHE_KEY,
        JSON.stringify(formatted),
        'EX',
        this.CACHE_TTL_SECONDS
      );
    } catch {
      logger.warn('Redis write failed for dashboard cache');
    }

    return formatted;
  }

  /* =====================================================
     Manual Cache Invalidation
  ===================================================== */
  static async clearDashboardCache() {
    try {
      await redis.del(this.DASHBOARD_CACHE_KEY);
      logger.info('Admin dashboard cache cleared');
    } catch {
      logger.warn('Failed to clear dashboard cache');
    }
  }
}