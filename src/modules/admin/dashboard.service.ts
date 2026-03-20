import { prisma }        from '../../config/database';
import { redis }         from '../../config/redis';
import {
  ApplicationStatus,
  TransactionStatus,
  TransactionType,
  UserRole,
  KycStatus,
}                        from '@prisma/client';
import { buildPaginationMeta } from '../../core/types';
import logger            from '../../core/logger';

/**
 * KAAGAZSEVA - Dashboard Service
 * Founder-Level Analytics
 * Single source of truth — replaces admin.service.ts
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

    // 2. Fetch all in parallel
    const [
      totalRevenue,
      platformRevenue,
      totalRefunds,
      totalApplications,
      completedApplications,
      activeAgents,
      highRiskApplications,
    ] = await Promise.all([

      // Customer payments (escrow holds)
      prisma.transaction.aggregate({
        where: {
          type:   TransactionType.ESCROW_HOLD,
          status: TransactionStatus.SUCCESS,
        },
        _sum: { amount: true },
      }),

      // Platform earnings (released escrows)
      prisma.escrowHolding.aggregate({
        where: { isReleased: true },
        _sum:  { platformAmount: true },
      }),

      // Refunds issued
      prisma.transaction.aggregate({
        where: {
          type:   TransactionType.REFUND,
          status: TransactionStatus.SUCCESS,
        },
        _sum: { amount: true },
      }),

      prisma.application.count(),

      prisma.application.count({
        where: { status: ApplicationStatus.COMPLETED },
      }),

      prisma.user.count({
        where: { role: UserRole.AGENT, isActive: true },
      }),

      prisma.application.count({
        where: { riskScore: { gt: 7 } },
      }),
    ]);

    const revenue = Number(totalRevenue._sum.amount    ?? 0);
    const refunds = Number(totalRefunds._sum.amount    ?? 0);
    const refundRatio = revenue === 0
      ? 0
      : Number(((refunds / revenue) * 100).toFixed(2));

    const formatted = {
      totalRevenue:         revenue,
      platformRevenue:      Number(platformRevenue._sum.platformAmount ?? 0),
      totalRefunds:         refunds,
      refundRatio,
      totalApplications,
      completedApplications,
      activeAgents,
      highRiskApplications,
      lastUpdated:          new Date().toISOString(),
    };

    // 3. Cache result
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
     Groups by stateId, joins state names
  ===================================================== */

  static async getStateAnalytics() {
    const grouped = await prisma.application.groupBy({
      by:      ['stateId'],   // ✅ correct field
      _count:  { id: true },
      _sum:    { totalAmount: true },
      orderBy: { _sum: { totalAmount: 'desc' } },
    });

    const stateIds = grouped.map(g => g.stateId);
    const states   = await prisma.state.findMany({
      where:  { id: { in: stateIds } },
      select: { id: true, name: true, code: true },
    });

    return grouped.map((item) => {
      const state = states.find(s => s.id === item.stateId);
      return {
        stateId:           item.stateId,
        stateName:         state?.name ?? 'Unknown',
        stateCode:         state?.code ?? '',
        totalApplications: item._count.id,
        totalRevenue:      Number(item._sum.totalAmount ?? 0),
      };
    });
  }

  /* =====================================================
     DISTRICT ANALYTICS
     Groups by districtId, optionally filtered by stateId
  ===================================================== */

  static async getDistrictAnalytics(stateId?: string) {
    const grouped = await prisma.application.groupBy({
      by:      ['districtId'],  // ✅ correct field
      where:   stateId ? { stateId } : undefined,
      _count:  { id: true },
      _sum:    { totalAmount: true },
      orderBy: { _sum: { totalAmount: 'desc' } },
    });

    const districtIds = grouped.map(g => g.districtId);
    const districts   = await prisma.district.findMany({
      where:  { id: { in: districtIds } },
      select: {
        id:    true,
        name:  true,
        state: { select: { name: true, code: true } },
      },
    });

    return grouped.map((item) => {
      const district = districts.find(d => d.id === item.districtId);
      return {
        districtId:        item.districtId,
        districtName:      district?.name       ?? 'Unknown',
        stateName:         district?.state.name ?? 'Unknown',
        stateCode:         district?.state.code ?? '',
        totalApplications: item._count.id,
        totalRevenue:      Number(item._sum.totalAmount ?? 0),
      };
    });
  }

  /* =====================================================
     TOP AGENTS
  ===================================================== */

  static async getTopAgents(limit: number = 10) {
    const agents = await prisma.agentMetrics.findMany({
      orderBy: { completedCases: 'desc' },
      take:    limit,
      include: {
        agent: {
          select: {
            id:         true,
            name:       true,
            email:      true,        // ✅ not phoneNumber
            stateId:    true,        // ✅ correct field
            districtId: true,        // ✅ correct field
          },
        },
      },
    });

    return agents.map(m => ({
      agentId:        m.agentId,
      agentName:      m.agent.name,
      email:          m.agent.email,
      completedCases: m.completedCases,
      rating:         m.rating,
      activeCases:    m.activeCases,
    }));
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

    const result = await prisma.transaction.aggregate({
      where: {
        type:      TransactionType.ESCROW_HOLD,
        status:    TransactionStatus.SUCCESS,
        createdAt: { gte: from },
      },
      _sum:   { amount: true },
      _count: { id: true },
    });

    return {
      period,
      from:         from.toISOString(),
      revenue:      Number(result._sum.amount ?? 0),
      transactions: result._count.id,
    };
  }

  /* =====================================================
     APPLICATIONS WITH FILTERS (paginated)
  ===================================================== */

  static async getApplications(params: {
    status?: string;
    page:    number;
    limit:   number;
  }) {
    const { status, page, limit } = params;
    const skip  = (page - 1) * limit;
    const where = status
      ? { status: status as ApplicationStatus }
      : {};

    const [items, total] = await Promise.all([
      prisma.application.findMany({
        where,
        skip,
        take:    limit,
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
     AGENTS WITH FILTERS (paginated)
  ===================================================== */

  static async getAgents(params: {
    page:       number;
    limit:      number;
    kycStatus?: string;
  }) {
    const { page, limit, kycStatus } = params;
    const skip  = (page - 1) * limit;
    const where = kycStatus
      ? { agentProfile: { kycStatus: kycStatus as KycStatus } }
      : { agentProfile: { isNot: null } };

    const [items, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take:    limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id:    true,
          name:  true,
          email: true,
          agentProfile: {
            select: {
              kycStatus:       true,
              isAvailable:     true,
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
     CACHE INVALIDATION
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