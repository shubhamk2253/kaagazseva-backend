import { prisma } from '../../config/database';
import { redis } from '../../config/redis';
import {
  ApplicationStatus,
  ServiceMode,
  UserRole,
} from '@prisma/client';
import { AppError } from '../../core/AppError';
import { AgentPriorityEngine } from './agent.priority.engine';
import logger from '../../core/logger';

export class AssignmentEngine {

  //////////////////////////////////////////////////////
  // 🚀 AUTO ASSIGN WITH REDIS DISTRIBUTED LOCK
  //////////////////////////////////////////////////////

  static async autoAssign(applicationId: string) {

    const lockKey = `assignment_lock:${applicationId}`;

    // 🔒 Acquire Redis Lock (30 sec safety)
    const lock = await redis.set(
  lockKey,
  'locked',
  'EX',
  30,
  'NX'
);

    if (!lock) {
      logger.warn(`⚠️ Assignment already in progress → ${applicationId}`);
      return;
    }

    try {

      const application = await prisma.application.findUnique({
        where: { id: applicationId },
      });

      if (!application) {
        throw new AppError('Application not found', 404);
      }

      if (application.status !== ApplicationStatus.SUBMITTED) {
        return; // silently ignore if already processed
      }

      //////////////////////////////////////////////////////
      // 1️⃣ SAME DISTRICT
      //////////////////////////////////////////////////////

      let agents = await this.findEligibleAgents({
        state: application.state,
        district: application.district,
      });

      if (agents.length) {
        return await this.assign(applicationId, agents);
      }

      //////////////////////////////////////////////////////
      // 2️⃣ SAME STATE
      //////////////////////////////////////////////////////

      agents = await this.findEligibleAgents({
        state: application.state,
      });

      if (agents.length) {
        return await this.assign(applicationId, agents);
      }

      //////////////////////////////////////////////////////
      // 3️⃣ GEO FALLBACK (DOORSTEP ONLY)
      //////////////////////////////////////////////////////

      if (
        application.mode === ServiceMode.DOORSTEP &&
        application.customerLat &&
        application.customerLng
      ) {

        agents = await this.findGeoAgents(
          application.customerLat,
          application.customerLng
        );

        if (agents.length) {
          return await this.assign(applicationId, agents);
        }
      }

      //////////////////////////////////////////////////////
      // 4️⃣ ADMIN ESCALATION
      //////////////////////////////////////////////////////

      await prisma.application.update({
        where: { id: applicationId },
        data: { manualReview: true },
      });

      logger.warn(
        `❌ No agents found → Manual review required for ${applicationId}`
      );

      return {
        message: 'No agents available. Escalated to admin.',
      };

    } finally {
      // 🔓 Always release lock
      await redis.del(lockKey);
    }
  }

  //////////////////////////////////////////////////////
  // 🔍 FIND ELIGIBLE AGENTS
  //////////////////////////////////////////////////////

  private static async findEligibleAgents(filter: {
    state?: string;
    district?: string;
  }) {

    return prisma.user.findMany({
      where: {
        role: UserRole.AGENT,
        isActive: true,
        ...(filter.state && { state: filter.state }),
        ...(filter.district && { district: filter.district }),
        agentMetrics: {
          activeCases: { lt: 25 },
        },
      },
      include: {
        agentMetrics: true,
      },
    });
  }

  //////////////////////////////////////////////////////
  // 📍 GEO AGENTS (25KM LIMIT)
  //////////////////////////////////////////////////////

  private static async findGeoAgents(
    lat: number,
    lng: number
  ) {

    const agents = await prisma.user.findMany({
      where: {
        role: UserRole.AGENT,
        isActive: true,
        latitude: { not: null },
        longitude: { not: null },
        agentMetrics: {
          activeCases: { lt: 25 },
        },
      },
      include: {
        agentMetrics: true,
      },
    });

    return agents.filter(agent => {

      const distance = AgentPriorityEngine.calculateDistance(
        lat,
        lng,
        agent.latitude!,
        agent.longitude!
      );

      return distance <= 25;
    });
  }

  //////////////////////////////////////////////////////
  // 🏆 FINAL ASSIGN LOGIC
  //////////////////////////////////////////////////////

  private static async assign(
    applicationId: string,
    agents: any[]
  ) {

    if (!agents.length) {
      throw new AppError('No eligible agents', 400);
    }

    const bestAgent = AgentPriorityEngine.getBestAgent(agents);

    if (!bestAgent) {
      throw new AppError('No valid agent selected', 400);
    }

    const deadline = new Date(Date.now() + 60 * 60 * 1000);

    await prisma.$transaction(async (tx) => {

      await tx.application.update({
        where: { id: applicationId },
        data: {
          agentId: bestAgent.id,
          status: ApplicationStatus.ASSIGNED,
          assignedAt: new Date(),
          assignmentDeadline: deadline,
          manualReview: false,
        },
      });

      await tx.agentMetrics.update({
        where: { agentId: bestAgent.id },
        data: {
          activeCases: { increment: 1 },
        },
      });

    });

    logger.info(
      `✅ Application ${applicationId} assigned to ${bestAgent.id}`
    );

    return {
      agentId: bestAgent.id,
      deadline,
    };
  }
}