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
  // AUTO ASSIGN
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
      logger.warn(`Assignment already running → ${applicationId}`);
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

      //////////////////////////////////////////////////////
      // REDIS ESCALATION LEVEL
      //////////////////////////////////////////////////////

      const escalationKey = `assignment_escalation:${applicationId}`;

      let level =
        Number(await redis.get(escalationKey)) || 1;

      let agents: any[] = [];

      //////////////////////////////////////////////////////
      // LEVEL 1 → DISTRICT
      //////////////////////////////////////////////////////

      if (level === 1) {

        agents = await this.findEligibleAgents({
          state: application.state,
          district: application.district,
          serviceId: application.serviceId!,
        });

      }

      //////////////////////////////////////////////////////
      // LEVEL 2 → STATE
      //////////////////////////////////////////////////////

      else if (level === 2) {

        agents = await this.findEligibleAgents({
          state: application.state,
          serviceId: application.serviceId!,
        });

      }

      //////////////////////////////////////////////////////
      // LEVEL 3 → GEO (Doorstep only)
      //////////////////////////////////////////////////////

      else if (level === 3) {

        if (
          application.mode === ServiceMode.DOORSTEP &&
          application.customerLat &&
          application.customerLng
        ) {

          agents = await this.findGeoAgents(
            application.customerLat,
            application.customerLng,
            application.serviceId!
          );
        }
      }

      //////////////////////////////////////////////////////
      // LEVEL 4 → ADMIN REVIEW
      //////////////////////////////////////////////////////

      else {

        await prisma.application.update({
          where: { id: applicationId },
          data: {
            status: ApplicationStatus.UNDER_REVIEW,
          },
        });

        logger.warn(
          `Escalated to admin review → ${applicationId}`
        );

        return { message: 'Escalated to admin review' };
      }

      //////////////////////////////////////////////////////
      // NO AGENTS → ESCALATE
      //////////////////////////////////////////////////////

      if (!agents.length) {

        await redis.set(
          escalationKey,
          level + 1,
          'EX',
          3600
        );

        return await this.autoAssign(applicationId);
      }

      //////////////////////////////////////////////////////
      // ASSIGN
      //////////////////////////////////////////////////////

      return await this.assign(applicationId, agents);

    } finally {

      await redis.del(lockKey);
    }
  }

  //////////////////////////////////////////////////////
  // FIND AGENTS
  //////////////////////////////////////////////////////

  private static async findEligibleAgents(filter: {
    state?: string;
    district?: string;
    serviceId: string;
  }) {

    return prisma.user.findMany({
      where: {

        role: UserRole.AGENT,
        isActive: true,

        suspensionStatus: SuspensionStatus.NONE,

        ...(filter.state && { state: filter.state }),
        ...(filter.district && { district: filter.district }),

        agentServices: {
          some: {
            serviceId: filter.serviceId,
            isActive: true,
          },
        },

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
  // GEO AGENTS
  //////////////////////////////////////////////////////

  private static async findGeoAgents(
    lat: number,
    lng: number,
    serviceId: string
  ) {

    const agents = await prisma.user.findMany({
      where: {

        role: UserRole.AGENT,
        isActive: true,
        suspensionStatus: SuspensionStatus.NONE,

        latitude: { not: null },
        longitude: { not: null },

        agentServices: {
          some: {
            serviceId,
            isActive: true,
          },
        },

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
  // FINAL ASSIGN
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
      `Application ${applicationId} assigned → ${bestAgent.id}`
    );

    return { agentId: bestAgent.id, deadline };
  }
}