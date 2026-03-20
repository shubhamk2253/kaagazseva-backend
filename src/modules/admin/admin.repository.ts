import { prisma }  from '../../config/database';
import {
  Prisma,
  TransactionType,
  TransactionStatus,
  ApplicationStatus,
  UserRole,
} from '@prisma/client';

/**
 * KAAGAZSEVA - Admin Repository
 * Founder-Level Analytics Engine
 * All queries aligned to locked Prisma schema
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
      prisma.user.count({
        where: {
          role: {
            in: [
              UserRole.STATE_ADMIN,
              UserRole.DISTRICT_ADMIN,
              UserRole.FOUNDER,
            ],
          },
        },
      }),
      prisma.user.count({ where: { createdAt: { gte: today } } }),
      prisma.application.groupBy({
        by:    ['status'],
        _count: { id: true },
      }),
      prisma.wallet.aggregate({
        _sum: { balance: true },
      }),
    ]);

    // Build stats using locked schema enum values
    const applicationStats: Record<string, number> = {
      total:          0,
      draft:          0,
      pendingPayment: 0,
      paid:           0,
      assigning:      0,
      assigned:       0,
      accepted:       0,
      inProgress:     0,
      docsCollected:  0,
      submitted:      0,
      govtProcessing: 0,
      completed:      0,
      confirmed:      0,
      closed:         0,
      disputed:       0,
      refundPending:  0,
      refunded:       0,
      cancelled:      0,
      rejected:       0,
    };

    applicationGrouped.forEach((item) => {
      const count = item._count.id ?? 0;
      applicationStats.total += count;

      const statusMap: Record<string, string> = {
        [ApplicationStatus.DRAFT]:           'draft',
        [ApplicationStatus.PENDING_PAYMENT]: 'pendingPayment',
        [ApplicationStatus.PAID]:            'paid',
        [ApplicationStatus.ASSIGNING]:       'assigning',
        [ApplicationStatus.ASSIGNED]:        'assigned',
        [ApplicationStatus.ACCEPTED]:        'accepted',
        [ApplicationStatus.IN_PROGRESS]:     'inProgress',
        [ApplicationStatus.DOCS_COLLECTED]:  'docsCollected',
        [ApplicationStatus.SUBMITTED]:       'submitted',
        [ApplicationStatus.GOVT_PROCESSING]: 'govtProcessing',
        [ApplicationStatus.COMPLETED]:       'completed',
        [ApplicationStatus.CONFIRMED]:       'confirmed',
        [ApplicationStatus.CLOSED]:          'closed',
        [ApplicationStatus.DISPUTED]:        'disputed',
        [ApplicationStatus.REFUND_PENDING]:  'refundPending',
        [ApplicationStatus.REFUNDED]:        'refunded',
        [ApplicationStatus.CANCELLED]:       'cancelled',
        [ApplicationStatus.REJECTED]:        'rejected',
      };

      const key = statusMap[item.status];
      if (key) applicationStats[key] = count;
    });

    return {
      users: { totalCitizens, totalAgents, totalAdmins, newToday },
      applications: applicationStats,
      totalWalletBalance: Number(walletAggregate._sum.balance ?? 0),
    };
  }

  /* =====================================================
     TOTAL REVENUE
     Platform revenue = ESCROW_HOLD transactions
  ===================================================== */

  static async getRevenueStats() {
    const result = await prisma.transaction.aggregate({
      where: {
        type:   TransactionType.ESCROW_HOLD,
        status: TransactionStatus.SUCCESS,
      },
      _sum:   { amount: true },
      _count: { id: true },
    });

    return {
      totalRevenue:      Number(result._sum.amount ?? 0),
      totalTransactions: result._count.id ?? 0,
    };
  }

  /* =====================================================
     REVENUE GROWTH % (Last 30 vs Previous 30 Days)
  ===================================================== */

  static async getRevenueGrowth() {
    const now        = new Date();
    const last30     = new Date(now);
    last30.setDate(now.getDate() - 30);
    const previous30 = new Date(now);
    previous30.setDate(now.getDate() - 60);

    const [currentRevenue, previousRevenue] = await Promise.all([
      prisma.transaction.aggregate({
        where: {
          type:      TransactionType.ESCROW_HOLD,
          status:    TransactionStatus.SUCCESS,
          createdAt: { gte: last30 },
        },
        _sum: { amount: true },
      }),
      prisma.transaction.aggregate({
        where: {
          type:      TransactionType.ESCROW_HOLD,
          status:    TransactionStatus.SUCCESS,
          createdAt: { gte: previous30, lt: last30 },
        },
        _sum: { amount: true },
      }),
    ]);

    const current  = Number(currentRevenue._sum.amount  ?? 0);
    const previous = Number(previousRevenue._sum.amount ?? 0);
    const growth   = previous === 0
      ? 0
      : ((current - previous) / previous) * 100;

    return {
      currentPeriodRevenue:  current,
      previousPeriodRevenue: previous,
      growthPercent:         Number(growth.toFixed(2)),
    };
  }

  /* =====================================================
     DAILY REVENUE TREND (Last 7 Days)
     Uses $queryRaw with Prisma.sql — injection safe
  ===================================================== */

  static async getDailyRevenueTrend() {
    const result = await prisma.$queryRaw
      { date: Date; total: bigint }[]
    >(Prisma.sql`
      SELECT
        DATE_TRUNC('day', "createdAt") AS date,
        SUM("amount")                  AS total
      FROM "Transaction"
      WHERE type   = ${TransactionType.ESCROW_HOLD}
        AND status = ${TransactionStatus.SUCCESS}
        AND "createdAt" >= NOW() - INTERVAL '7 days'
      GROUP BY date
      ORDER BY date ASC
    `);

    return result.map((row) => ({
      date:    row.date.toISOString().split('T')[0],
      revenue: Number(row.total ?? 0),
    }));
  }

  /* =====================================================
     REFUND ANALYTICS (Last 30 Days)
  ===================================================== */

  static async getRefundAnalytics() {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [revenueResult, refundResult] = await Promise.all([
      prisma.transaction.aggregate({
        where: {
          type:      TransactionType.ESCROW_HOLD,
          status:    TransactionStatus.SUCCESS,
          createdAt: { gte: thirtyDaysAgo },
        },
        _sum: { amount: true },
      }),
      prisma.transaction.aggregate({
        where: {
          type:      TransactionType.REFUND,
          status:    TransactionStatus.SUCCESS,
          createdAt: { gte: thirtyDaysAgo },
        },
        _sum: { amount: true },
      }),
    ]);

    const revenue = Number(revenueResult._sum.amount ?? 0);
    const refunds = Number(refundResult._sum.amount  ?? 0);
    const ratio   = revenue === 0
      ? 0
      : (refunds / revenue) * 100;

    return {
      revenueLast30Days:  revenue,
      refundsLast30Days:  refunds,
      refundRatioPercent: Number(ratio.toFixed(2)),
      riskLevel:          this.getRefundRiskLevel(ratio),
    };
  }

  private static getRefundRiskLevel(ratio: number): string {
    if (ratio > 7) return 'HIGH';
    if (ratio > 3) return 'MEDIUM';
    return 'LOW';
  }

  /* =====================================================
     AGENT LEADERBOARD (Top N)
  ===================================================== */

  static async getAgentLeaderboard(limit: number = 5) {
    const leaderboard = await prisma.application.groupBy({
      by:    ['agentId'],
      where: {
        status:  ApplicationStatus.COMPLETED,
        agentId: { not: null },
      },
      _count:  { id: true },
      orderBy: { _count: { id: 'desc' } },
      take:    limit,
    });

    const agentIds = leaderboard
      .map((l) => l.agentId)
      .filter((id): id is string => id !== null);

    const agents = await prisma.user.findMany({
      where:  { id: { in: agentIds } },
      select: {
        id:    true,
        name:  true,
        email: true,
      },
    });

    return leaderboard.map((entry) => {
      const agent = agents.find((a) => a.id === entry.agentId);
      return {
        agentId:               entry.agentId,
        agentName:             agent?.name  ?? 'Unknown',
        email:                 agent?.email ?? '',
        completedApplications: entry._count.id ?? 0,
      };
    });
  }
}