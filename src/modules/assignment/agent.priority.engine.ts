import { prisma }      from '../../config/database';
import { User, AgentMetrics, AgentProfile } from '@prisma/client';
import { ASSIGNMENT }  from '../../core/constants';

/**
 * KAAGAZSEVA - Agent Priority Engine
 * Calculates assignment priority scores for agents
 *
 * Score formula:
 * (MAX_CASES - activeCases)     workload component
 * + rating                       quality component
 * - (rejectionCount × 0.5)      reliability penalty
 * - (timeoutCount   × 1.0)      availability penalty
 * - (penaltyCount   × 2.0)      conduct penalty
 */

/* =====================================================
   TYPES
===================================================== */

export type AgentWithMetrics = User & {
  agentMetrics: AgentMetrics | null;
  agentProfile: AgentProfile | null;
};

/* =====================================================
   ENGINE
===================================================== */

export class AgentPriorityEngine {

  /* =====================================================
     CALCULATE SCORE FROM METRICS OBJECT
     Used internally and in batch recalculation
  ===================================================== */

  static calculateScoreFromMetrics(metrics: AgentMetrics): number {
    const workloadScore    = ASSIGNMENT.MAX_ACTIVE_CASES_PER_AGENT
                             - (metrics.activeCases ?? 0);
    const ratingScore      = metrics.rating        ?? 5;
    const rejectionPenalty = (metrics.rejectionCount ?? 0) * 0.5;
    const timeoutPenalty   = (metrics.timeoutCount   ?? 0) * 1.0;
    const penaltyScore     = (metrics.penaltyCount   ?? 0) * 2.0;

    const score =
      workloadScore +
      ratingScore   -
      rejectionPenalty -
      timeoutPenalty   -
      penaltyScore;

    return Math.max(Number(score.toFixed(2)), 0);
  }

  /* =====================================================
     CALCULATE SCORE FROM AGENT
  ===================================================== */

  static calculateScore(agent: AgentWithMetrics): number {
    if (!agent.agentMetrics) return 0;
    return this.calculateScoreFromMetrics(agent.agentMetrics);
  }

  /* =====================================================
     GET BEST AGENT FROM CANDIDATE LIST
  ===================================================== */

  static getBestAgent(
    agents: AgentWithMetrics[]
  ): AgentWithMetrics | null {

    if (!agents.length) return null;

    const scored = agents.map(agent => ({
      agent,
      score: this.calculateScore(agent),
    }));

    scored.sort((a, b) => {
      // Primary: highest priority score
      if (b.score !== a.score) return b.score - a.score;

      // Tie-breaker 1: fewer active cases
      const activeCasesA = a.agent.agentMetrics?.activeCases ?? 0;
      const activeCasesB = b.agent.agentMetrics?.activeCases ?? 0;
      if (activeCasesA !== activeCasesB) return activeCasesA - activeCasesB;

      // Tie-breaker 2: higher rating
      const ratingA = a.agent.agentMetrics?.rating ?? 5;
      const ratingB = b.agent.agentMetrics?.rating ?? 5;
      return ratingB - ratingA;
    });

    return scored[0].agent;
  }

  /* =====================================================
     HAVERSINE DISTANCE (KM)
     Accurate great-circle distance between two coordinates
  ===================================================== */

  static calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {

    const R     = 6371; // Earth radius in km
    const toRad = (deg: number) => deg * (Math.PI / 180);

    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);

    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) ** 2;

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return Number((R * c).toFixed(2));
  }

  /* =====================================================
     CHECK IF AGENT IS WITHIN RADIUS
  ===================================================== */

  static isWithinRadius(
    agentLat:    number,
    agentLng:    number,
    customerLat: number,
    customerLng: number,
    radiusKm:    number = ASSIGNMENT.GEO_SEARCH_RADIUS_KM
  ): boolean {
    const distance = this.calculateDistance(
      agentLat, agentLng,
      customerLat, customerLng
    );
    return distance <= radiusKm;
  }

  /* =====================================================
     RECALCULATE AND PERSIST SCORE FOR ONE AGENT
  ===================================================== */

  static async recalculate(agentId: string): Promise<number | null> {
    const metrics = await prisma.agentMetrics.findUnique({
      where: { agentId },
    });

    if (!metrics) return null;

    const newScore = this.calculateScoreFromMetrics(metrics);

    await prisma.agentMetrics.update({
      where: { agentId },
      data:  { priorityScore: newScore },
    });

    return newScore;
  }

  /* =====================================================
     BATCH RECALCULATE ALL ACTIVE AGENTS
     Called by daily cron job at 3 AM IST
  ===================================================== */

  static async recalculateAll(): Promise<void> {
    const allMetrics = await prisma.agentMetrics.findMany();

    await Promise.all(
      allMetrics.map(async (metrics) => {
        const newScore = this.calculateScoreFromMetrics(metrics);
        await prisma.agentMetrics.update({
          where: { agentId: metrics.agentId },
          data:  { priorityScore: newScore },
        });
      })
    );
  }
}