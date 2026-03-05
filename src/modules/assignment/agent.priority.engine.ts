import { prisma } from '../../config/database';
import { User, AgentMetrics } from '@prisma/client';

type AgentWithMetrics = User & {
  agentMetrics: AgentMetrics | null;
};

export class AgentPriorityEngine {

  //////////////////////////////////////////////////////
  // PRIORITY SCORE FORMULA
  //
  // Score = (25 - activeCases)
  //       + rating
  //       - (rejectionCount * 0.5)
  //       - (timeoutCount * 1)
  //////////////////////////////////////////////////////

  static calculateScore(agent: AgentWithMetrics): number {

    const metrics = agent.agentMetrics;

    const workloadScore = 25 - (metrics?.activeCases ?? 0);
    const ratingScore = metrics?.rating ?? 5;
    const rejectionPenalty = (metrics?.rejectionCount ?? 0) * 0.5;
    const timeoutPenalty = (metrics?.timeoutCount ?? 0) * 1;

    const score =
      workloadScore +
      ratingScore -
      rejectionPenalty -
      timeoutPenalty;

    return Math.max(score, 0); // prevent negative scores
  }

  //////////////////////////////////////////////////////
  // GET BEST AGENT
  //////////////////////////////////////////////////////

  static getBestAgent(agents: AgentWithMetrics[]) {

    if (!agents.length) return null;

    const scored = agents.map(agent => ({
      ...agent,
      priorityScore: this.calculateScore(agent),
    }));

    scored.sort((a, b) => {

      // Primary: priority score
      if (b.priorityScore !== a.priorityScore) {
        return b.priorityScore - a.priorityScore;
      }

      // Tie-breaker 1: fewer active cases
      const activeA = a.agentMetrics?.activeCases ?? 0;
      const activeB = b.agentMetrics?.activeCases ?? 0;

      if (activeA !== activeB) {
        return activeA - activeB;
      }

      // Tie-breaker 2: higher rating
      const ratingA = a.agentMetrics?.rating ?? 5;
      const ratingB = b.agentMetrics?.rating ?? 5;

      return ratingB - ratingA;
    });

    return scored[0];
  }

  //////////////////////////////////////////////////////
  // HAVERSINE DISTANCE (KM)
  //////////////////////////////////////////////////////

  static calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {

    const R = 6371;

    const toRad = (deg: number) =>
      deg * (Math.PI / 180);

    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);

    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) *
        Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) ** 2;

    const c =
      2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  //////////////////////////////////////////////////////
  // RECALCULATE PRIORITY SCORE
  //////////////////////////////////////////////////////

  static async recalculate(agentId: string) {

    const agent = await prisma.user.findUnique({
      where: { id: agentId },
      include: { agentMetrics: true },
    });

    if (!agent || !agent.agentMetrics) {
      return null;
    }

    const newScore = this.calculateScore(agent);

    await prisma.agentMetrics.update({
      where: { agentId },
      data: {
        priorityScore: newScore,
      },
    });

    return newScore;
  }
}