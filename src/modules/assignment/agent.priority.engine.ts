import { prisma } from '../../config/database';

export class AgentPriorityEngine {

  //////////////////////////////////////////////////////
  // 🧮 PRIORITY SCORE FORMULA
  //
  // Score = (25 - activeCases)
  //       + rating
  //       - (rejectionCount * 0.5)
  //       - (timeoutCount * 1)
  //////////////////////////////////////////////////////

  static calculateScore(agent: any): number {

    const metrics = agent.agentMetrics;

    const workloadScore = 25 - (metrics?.activeCases ?? 0);
    const ratingScore = metrics?.rating ?? 5;
    const rejectionPenalty = (metrics?.rejectionCount ?? 0) * 0.5;
    const timeoutPenalty = (metrics?.timeoutCount ?? 0) * 1;

    return workloadScore + ratingScore - rejectionPenalty - timeoutPenalty;
  }

  //////////////////////////////////////////////////////
  // 🏆 GET BEST AGENT (Highest Score Wins)
  //////////////////////////////////////////////////////

  static getBestAgent(agents: any[]) {

    if (!agents.length) return null;

    const scored = agents.map(agent => ({
      ...agent,
      priorityScore: this.calculateScore(agent),
    }));

    scored.sort((a, b) => b.priorityScore - a.priorityScore);

    return scored[0];
  }

  //////////////////////////////////////////////////////
  // 📍 HAVERSINE DISTANCE (KM)
  //////////////////////////////////////////////////////

  static calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {

    const R = 6371; // Earth radius in km

    const toRad = (deg: number) => deg * (Math.PI / 180);

    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) *
        Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  //////////////////////////////////////////////////////
  // 🔄 RECALCULATE & SAVE PRIORITY SCORE
  // Called after:
  // Accept
  // Reject
  // Timeout
  // Completion
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