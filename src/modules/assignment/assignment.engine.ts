import { prisma } from '../../config/database';
import { redis } from '../../config/redis';
import {
  ApplicationStatus,
  ServiceMode,
  UserRole,
  SuspensionStatus,
} from '@prisma/client';
import { AppError } from '../../core/AppError';
import { AgentPriorityEngine } from './agent.priority.engine';
import logger from '../../core/logger';

type AssignmentResult =
  | { agentId: string; deadline: Date }
  | { message: string }
  | void;

export class AssignmentEngine {

  //////////////////////////////////////////////////////
  // 🚀 AUTO ASSIGN WITH ESCALATION LADDER
  //////////////////////////////////////////////////////

  static async autoAssign(
    applicationId: string
  ): Promise<AssignmentResult> {

    const lockKey = `assignment_lock:${applicationId}`;

    const lock = await redis.set(
      lockKey,
      'locked',
      'EX',
      30,
      'NX'
    );

    if (!lock) {
      logger.warn(`⚠️ Assignment already running → ${applicationId}`);
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
        return;
      }

      const level = application.escalationLevel ?? 1;
      let agents: any[] = [];

      //////////////////////////////////////////////////////
      // LEVEL 1 → DISTRICT
      //////////////////////////////////////////////////////

      if (level === 1) {
        logger.info(`📍 Level 1 (District) → ${applicationId}`);

        agents = await this.findEligibleAgents({
          state: application.state,
          district: application.district,
        });
      }

      //////////////////////////////////////////////////////
      // LEVEL 2 → STATE
      //////////////////////////////////////////////////////

      else if (level === 2) {
        logger.info(`🌍 Level 2 (State) → ${applicationId}`);

        agents = await this.findEligibleAgents({
          state: application.state,
        });
      }

      //////////////////////////////////////////////////////
      // LEVEL 3 → GEO (Doorstep only)
      //////////////////////////////////////////////////////

      else if (level === 3) {
        logger.info(`📡 Level 3 (Geo) → ${applicationId}`);

        if (
          application.mode === ServiceMode.DOORSTEP &&
          application.customerLat &&
          application.customerLng
        ) {
          agents = await this.findGeoAgents(
            application.customerLat,
            application.customerLng
          );
        }
      }

      //////////////////////////////////////////////////////
      // LEVEL 4+ → ADMIN REVIEW
      //////////////////////////////////////////////////////

      else {

        await prisma.application.update({
          where: { id: applicationId },
          data: {
            manualReview: true,
          },
        });

        logger.warn(
          `🚨 Escalated to admin review → ${applicationId}`
        );

        return { message: 'Escalated to admin review' };
      }

      //////////////////////////////////////////////////////
      // NO AGENTS FOUND → ESCALATE
      //////////////////////////////////////////////////////

      if (!agents.length) {

        await prisma.application.update({
          where: { id: applicationId },
          data: {
            escalationLevel: {
              increment: 1,
            },
          },
        });

        logger.warn(
          `⬆ Escalation increased → ${applicationId}`
        );

        // Retry with next level (safe recursion)
        return await this.autoAssign(applicationId);
      }

      //////////////////////////////////////////////////////
      // AGENTS FOUND → ASSIGN
      //////////////////////////////////////////////////////

      return await this.assign(applicationId, agents);

    } finally {
      await redis.del(lockKey);
    }
  }

  //////////////////////////////////////////////////////
  // 🔍 FIND ELIGIBLE AGENTS (SUSPENSION SAFE)
  //////////////////////////////////////////////////////

  private static async findEligibleAgents(filter: {
    state?: string;
    district?: string;
  }) {

    return prisma.user.findMany({
      where: {
        role: UserRole.AGENT,
        isActive: true,
        suspensionStatus: SuspensionStatus.ACTIVE, // 🔥 PHASE 5 PROTECTION

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
  // 📍 GEO AGENTS (25KM + SUSPENSION SAFE)
  //////////////////////////////////////////////////////

  private static async findGeoAgents(
    lat: number,
    lng: number
  ) {

    const agents = await prisma.user.findMany({
      where: {
        role: UserRole.AGENT,
        isActive: true,
        suspensionStatus: SuspensionStatus.ACTIVE, // 🔥 PHASE 5 PROTECTION

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
  // 🏆 FINAL ASSIGN
  //////////////////////////////////////////////////////

  private static async assign(
    applicationId: string,
    agents: any[]
  ): Promise<{ agentId: string; deadline: Date }> {

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
      `✅ Application ${applicationId} assigned → ${bestAgent.id}`
    );

    return { agentId: bestAgent.id, deadline };
  }
}