import { prisma } from '../../config/database';
import {
  TransactionType,
  TransactionStatus,
  ApplicationStatus,
  UserRole,
} from '@prisma/client';

/**
 * KAAGAZSEVA - Admin Repository
 * Founder-Level Analytics Engine
 */
export class AdminRepository {

  /* =====================================================
     PLATFORM SUMMARY
  ===================================================== */
  static async getPlatformSummary() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      totalCitizens,
      totalAgents,
      totalAdmins,
      newToday,
      applicationGrouped,
      walletAggregate,
    ] = await Promise.all([
      prisma.user.count({ where: { role: UserRole.CUSTOMER } }),
      prisma.user.count({ where: { role: UserRole.AGENT } }),
      prisma.user.count({ where: { role: UserRole.STATE_ADMIN } }),

      prisma.user.count({
        where: { createdAt: { gte: today } },
      }),

      prisma.application.groupBy({
        by: ['status'],
        _count: { id: true },
      }),

      prisma.wallet.aggregate({
        _sum: { balance: true },
      }),
    ]);

    const applicationStats = {
      total: 0,
      draft: 0,
      pendingPayment: 0,
      submitted: 0,
      underReview: 0,
      documentRequired: 0,
      completed: 0,
      rejected: 0,
    };

    applicationGrouped.forEach((item) => {
      const count = item._count.id ?? 0;
      applicationStats.total += count;

      switch (item.status) {
        case ApplicationStatus.DRAFT:
          applicationStats.draft = count;
          break;
        case ApplicationStatus.PENDING_PAYMENT:
          applicationStats.pendingPayment = count;
          break;
        case ApplicationStatus.SUBMITTED:
          applicationStats.submitted = count;
          break;
        case ApplicationStatus.UNDER_REVIEW:
          applicationStats.underReview = count;
          break;
        case ApplicationStatus.DOCUMENT_REQUIRED:
          applicationStats.documentRequired = count;
          break;
        case ApplicationStatus.COMPLETED:
          applicationStats.completed = count;
          break;
        case ApplicationStatus.REJECTED:
          applicationStats.rejected = count;
          break;
      }
    });

    return {
      users: {
        totalCitizens,
        totalAgents,
        totalAdmins,
        newToday,
      },
      applications: applicationStats,
      totalWalletBalance: Number(walletAggregate._sum.balance ?? 0),
    };
  }

  /* =====================================================
     TOTAL REVENUE
  ===================================================== */
  static async getRevenueStats() {
    const result = await prisma.transaction.aggregate({
      where: {
        type: TransactionType.DEBIT,
        status: TransactionStatus.SUCCESS,
      },
      _sum: { amount: true },
      _count: { id: true },
    });

    return {
      totalRevenue: Number(result._sum.amount ?? 0),
      totalTransactions: result._count.id ?? 0,
    };
  }

  /* =====================================================
     REVENUE GROWTH % (Last 30 vs Previous 30 Days)
  ===================================================== */
  static async getRevenueGrowth() {
    const now = new Date();

    const last30 = new Date();
    last30.setDate(now.getDate() - 30);

    const previous30 = new Date();
    previous30.setDate(now.getDate() - 60);

    const [currentRevenue, previousRevenue] = await Promise.all([
      prisma.transaction.aggregate({
        where: {
          type: TransactionType.DEBIT,
          status: TransactionStatus.SUCCESS,
          createdAt: { gte: last30 },
        },
        _sum: { amount: true },
      }),

      prisma.transaction.aggregate({
        where: {
          type: TransactionType.DEBIT,
          status: TransactionStatus.SUCCESS,
          createdAt: { gte: previous30, lt: last30 },
        },
        _sum: { amount: true },
      }),
    ]);

    const current = Number(currentRevenue._sum.amount ?? 0);
    const previous = Number(previousRevenue._sum.amount ?? 0);

    const growth =
      previous === 0 ? 0 : ((current - previous) / previous) * 100;

    return {
      currentPeriodRevenue: current,
      previousPeriodRevenue: previous,
      growthPercent: Number(growth.toFixed(2)),
    };
  }

  /* =====================================================
     DAILY REVENUE TREND (Last 7 Days)
  ===================================================== */
  static async getDailyRevenueTrend() {
    const result = await prisma.$queryRawUnsafe<
      { date: Date; total: bigint }[]
    >(`
      SELECT 
        DATE_TRUNC('day', "createdAt") as date, 
        SUM("amount") as total
      FROM "Transaction"
      WHERE "type" = 'DEBIT'
        AND "status" = 'SUCCESS'
        AND "createdAt" >= NOW() - INTERVAL '7 days'
      GROUP BY date
      ORDER BY date ASC
    `);

    return result.map((row) => ({
      date: row.date.toISOString().split('T')[0],
      revenue: Number(row.total ?? 0),
    }));
  }

  /* =====================================================
     REFUND RATIO MONITOR (Last 30 Days)
  ===================================================== */
  static async getRefundAnalytics() {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [revenueResult, refundResult] = await Promise.all([
      prisma.transaction.aggregate({
        where: {
          type: TransactionType.DEBIT,
          status: TransactionStatus.SUCCESS,
          createdAt: { gte: thirtyDaysAgo },
        },
        _sum: { amount: true },
      }),

      prisma.transaction.aggregate({
        where: {
          type: TransactionType.CREDIT,
          status: TransactionStatus.SUCCESS,
          createdAt: { gte: thirtyDaysAgo },
        },
        _sum: { amount: true },
      }),
    ]);

    const revenue = Number(revenueResult._sum.amount ?? 0);
    const refunds = Number(refundResult._sum.amount ?? 0);

    const ratio = revenue === 0 ? 0 : (refunds / revenue) * 100;

    return {
      revenueLast30Days: revenue,
      refundsLast30Days: refunds,
      refundRatioPercent: Number(ratio.toFixed(2)),
      riskLevel: this.getRefundRiskLevel(ratio),
    };
  }

  private static getRefundRiskLevel(ratio: number) {
    if (ratio > 7) return 'HIGH';
    if (ratio > 3) return 'MEDIUM';
    return 'LOW';
  }

  /* =====================================================
     AGENT LEADERBOARD (Top 5)
  ===================================================== */
  static async getAgentLeaderboard() {
    const leaderboard = await prisma.application.groupBy({
      by: ['agentId'],
      where: {
        status: ApplicationStatus.COMPLETED,
        agentId: { not: null },
      },
      _count: { id: true },
      orderBy: {
        _count: { id: 'desc' },
      },
      take: 5,
    });

    const agentIds = leaderboard
      .map((l) => l.agentId)
      .filter((id): id is string => id !== null);

    const agents = await prisma.user.findMany({
      where: { id: { in: agentIds } },
      select: {
        id: true,
        name: true,
        phoneNumber: true,
      },
    });

    return leaderboard.map((entry) => {
      const agent = agents.find((a) => a.id === entry.agentId);

      return {
        agentId: entry.agentId,
        agentName: agent?.name ?? 'Unknown',
        phoneNumber: agent?.phoneNumber ?? '',
        completedApplications: entry._count.id ?? 0,
      };
    });
  }
}