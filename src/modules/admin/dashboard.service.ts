import { prisma } from '../../config/database';
import {
  ApplicationStatus,
  TransactionStatus,
  TransactionType,
} from '@prisma/client';

export class DashboardService {

  //////////////////////////////////////////////////////
  // 🧠 FOUNDER NATIONAL OVERVIEW
  //////////////////////////////////////////////////////

  static async getFounderOverview() {

    const [
      totalRevenue,
      totalPlatformRevenue,
      totalRefunds,
      totalApplications,
      completedApplications,
      activeAgents,
      highRiskApplications,
    ] = await Promise.all([

      // 💰 Total Revenue (Escrow Hold SUCCESS)
      prisma.transaction.aggregate({
        where: {
          type: TransactionType.ESCROW_HOLD,
          status: TransactionStatus.SUCCESS,
        },
        _sum: {
          amount: true,
        },
      }),

      // 💼 Platform Earnings (from escrow)
      prisma.escrowHolding.aggregate({
        where: {
          isReleased: true,
        },
        _sum: {
          platformAmount: true,
        },
      }),

      // 🔁 Refunds
      prisma.transaction.aggregate({
        where: {
          type: TransactionType.REFUND,
          status: TransactionStatus.SUCCESS,
        },
        _sum: {
          amount: true,
        },
      }),

      // 📦 Total Applications
      prisma.application.count(),

      // ✅ Completed Applications
      prisma.application.count({
        where: {
          status: ApplicationStatus.COMPLETED,
        },
      }),

      // 👨‍💼 Active Agents
      prisma.user.count({
        where: {
          role: 'AGENT',
          isActive: true,
        },
      }),

      // ⚠ High Risk Alerts
      prisma.application.count({
        where: {
          riskScore: {
            gt: 7,
          },
        },
      }),
    ]);

    const refundRatio =
      (Number(totalRefunds._sum.amount ?? 0) /
        Number(totalRevenue._sum.amount ?? 1)) * 100;

    return {
      totalRevenue: Number(totalRevenue._sum.amount ?? 0),
      platformRevenue: Number(totalPlatformRevenue._sum.platformAmount ?? 0),
      totalRefunds: Number(totalRefunds._sum.amount ?? 0),
      refundRatio: Number(refundRatio.toFixed(2)),
      totalApplications,
      completedApplications,
      activeAgents,
      highRiskApplications,
    };
  }

  //////////////////////////////////////////////////////
  // 🌍 STATE ANALYTICS
  //////////////////////////////////////////////////////

  static async getStateAnalytics() {

    const states = await prisma.application.groupBy({
      by: ['state'],
      _count: {
        id: true,
      },
      _sum: {
        totalAmount: true,
      },
      orderBy: {
        _sum: {
          totalAmount: 'desc',
        },
      },
    });

    return states.map((state) => ({
      state: state.state,
      totalApplications: state._count.id,
      totalRevenue: Number(state._sum.totalAmount ?? 0),
    }));
  }

  //////////////////////////////////////////////////////
  // 🏘 DISTRICT ANALYTICS
  //////////////////////////////////////////////////////

  static async getDistrictAnalytics(state?: string) {

    const districts = await prisma.application.groupBy({
      by: ['district'],
      where: state ? { state } : undefined,
      _count: {
        id: true,
      },
      _sum: {
        totalAmount: true,
      },
      orderBy: {
        _sum: {
          totalAmount: 'desc',
        },
      },
    });

    return districts.map((district) => ({
      district: district.district,
      totalApplications: district._count.id,
      totalRevenue: Number(district._sum.totalAmount ?? 0),
    }));
  }

  //////////////////////////////////////////////////////
  // 📈 AGENT PERFORMANCE (TOP 10)
  //////////////////////////////////////////////////////

  static async getTopAgents(limit = 10) {

    const agents = await prisma.agentMetrics.findMany({
      orderBy: {
        completedCases: 'desc',
      },
      take: limit,
      include: {
        agent: {
          select: {
            id: true,
            name: true,
            state: true,
            district: true,
          },
        },
      },
    });

    return agents;
  }

}