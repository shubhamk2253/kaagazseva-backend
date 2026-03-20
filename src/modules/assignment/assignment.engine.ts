import { prisma }               from '../../config/database';
import { redis }                from '../../config/redis';
import {
  ApplicationStatus,
  AssignmentStatus,
  ServiceMode,
  UserRole,
  SuspensionStatus,
  AuditAction,
}                               from '@prisma/client';
import { AppError, ErrorCodes } from '../../core/AppError';
import { AgentPriorityEngine, AgentWithMetrics }
                                from './agent.priority.engine';
import { ASSIGNMENT }           from '../../core/constants';
import { QueueService }         from '../../workers/queue.service';
import logger                   from '../../core/logger';

/**
 * KAAGAZSEVA - Assignment Engine
 * Assigns best available agent to paid application
 * Fallback chain: District → State → Geo → Admin Alert
 */

export class AssignmentEngine {

  /* =====================================================
     AUTO ASSIGN — entry point
     Called by BullMQ after payment captured
  ===================================================== */

  static async autoAssign(applicationId: string): Promise<void> {

    // Per-application distributed lock
    const lockKey = `lock:assignment:${applicationId}`;
    const lock    = await redis.set(lockKey, '1', 'EX', 60, 'NX');

    if (!lock) {
      logger.warn({
        event:         'ASSIGNMENT_SKIPPED',
        reason:        'lock_active',
        applicationId,
      });
      return;
    }

    try {
      const application = await prisma.application.findUnique({
        where: { id: applicationId },
      });

      if (!application) {
        throw AppError.notFound('Application not found');
      }

      // Only assign PAID applications
      if (application.status !== ApplicationStatus.PAID) {
        logger.warn({
          event:         'ASSIGNMENT_SKIPPED',
          reason:        'wrong_status',
          status:        application.status,
          applicationId,
        });
        return;
      }

      // Update to ASSIGNING
      await prisma.application.update({
        where: { id: applicationId },
        data:  { status: ApplicationStatus.ASSIGNING },
      });

      // Try each level — no recursion
      const levels = [
        () => this.findByDistrict(application.districtId, application.serviceId!),
        () => this.findByState(application.stateId, application.serviceId!),
        () => this.findByGeo(
          application.customerLat,
          application.customerLng,
          application.serviceId!,
          application.mode
        ),
      ];

      let assigned = false;
      let attempt  = application.assignmentAttemptCount;

      for (const findAgents of levels) {
        attempt++;
        const agents = await findAgents();

        if (agents.length > 0) {
          await this.assign(applicationId, agents, attempt);
          assigned = true;
          break;
        }
      }

      // All levels exhausted → admin alert
      if (!assigned) {
        await prisma.application.update({
          where: { id: applicationId },
          data: {
            status:                ApplicationStatus.ON_HOLD,
            assignmentAttemptCount: attempt,
          },
        });

        // Notify founder via queue
        await QueueService.addNotificationJob({
          userId:  'founder', // replace with actual founder userId
          type:    'PUSH',
          title:   'No Agent Found',
          message: `Application ${applicationId} needs manual assignment`,
          data:    { applicationId, type: 'NO_AGENT_FOUND' },
        });

        logger.error({
          event:         'ASSIGNMENT_EXHAUSTED',
          applicationId,
          attempts:      attempt,
        });
      }

    } finally {
      await redis.del(lockKey);
    }
  }

  /* =====================================================
     FIND AGENTS — LEVEL 1: SAME DISTRICT
  ===================================================== */

  private static async findByDistrict(
    districtId: string,
    serviceId:  string
  ): Promise<AgentWithMetrics[]> {
    return prisma.user.findMany({
      where: {
        role:             UserRole.AGENT,
        isActive:         true,
        suspensionStatus: SuspensionStatus.NONE,
        districtId,                              // ✅ correct FK
        agentServices: {
          some: { serviceId, isActive: true },
        },
        agentMetrics: {
          activeCases: {
            lt: ASSIGNMENT.MAX_ACTIVE_CASES_PER_AGENT,
          },
        },
      },
      include: {
        agentMetrics: true,
        agentProfile: true,  // ✅ for location
      },
    }) as Promise<AgentWithMetrics[]>;
  }

  /* =====================================================
     FIND AGENTS — LEVEL 2: SAME STATE
  ===================================================== */

  private static async findByState(
    stateId:   string,
    serviceId: string
  ): Promise<AgentWithMetrics[]> {
    return prisma.user.findMany({
      where: {
        role:             UserRole.AGENT,
        isActive:         true,
        suspensionStatus: SuspensionStatus.NONE,
        stateId,                                 // ✅ correct FK
        agentServices: {
          some: { serviceId, isActive: true },
        },
        agentMetrics: {
          activeCases: {
            lt: ASSIGNMENT.MAX_ACTIVE_CASES_PER_AGENT,
          },
        },
      },
      include: {
        agentMetrics: true,
        agentProfile: true,
      },
    }) as Promise<AgentWithMetrics[]>;
  }

  /* =====================================================
     FIND AGENTS — LEVEL 3: GEO RADIUS
     Only for DOORSTEP and FULL_COMPLETION modes
  ===================================================== */

  private static async findByGeo(
    customerLat: number | null,
    customerLng: number | null,
    serviceId:   string,
    mode:        ServiceMode
  ): Promise<AgentWithMetrics[]> {

    // Geo only applicable for doorstep modes
    if (
      mode === ServiceMode.DIGITAL ||
      !customerLat ||
      !customerLng
    ) {
      return [];
    }

    const agents = await prisma.user.findMany({
      where: {
        role:             UserRole.AGENT,
        isActive:         true,
        suspensionStatus: SuspensionStatus.NONE,
        agentProfile: {
          latitude:  { not: null }, // ✅ correct location field
          longitude: { not: null },
        },
        agentServices: {
          some: { serviceId, isActive: true },
        },
        agentMetrics: {
          activeCases: {
            lt: ASSIGNMENT.MAX_ACTIVE_CASES_PER_AGENT,
          },
        },
      },
      include: {
        agentMetrics: true,
        agentProfile: true,
      },
    }) as AgentWithMetrics[];

    // Filter by radius using Haversine
    return agents.filter(agent => {
      const lat = agent.agentProfile?.latitude;
      const lng = agent.agentProfile?.longitude;

      if (!lat || !lng) return false;

      return AgentPriorityEngine.isWithinRadius(
        lat, lng,
        customerLat, customerLng,
        ASSIGNMENT.GEO_SEARCH_RADIUS_KM
      );
    });
  }

  /* =====================================================
     ASSIGN — atomic DB update + assignment record
  ===================================================== */

  private static async assign(
    applicationId: string,
    agents:        AgentWithMetrics[],
    attemptNumber: number
  ): Promise<void> {

    const bestAgent = AgentPriorityEngine.getBestAgent(agents);

    if (!bestAgent) {
      throw new AppError('No valid agent found', 500);
    }

    const deadline = new Date(
      Date.now() +
      ASSIGNMENT.ASSIGNMENT_ACCEPT_TIMEOUT_MINS * 60 * 1000
    );

    await prisma.$transaction(async (tx) => {

      // Update application
      await tx.application.update({
        where: { id: applicationId },
        data: {
          agentId:               bestAgent.id,
          status:                ApplicationStatus.ASSIGNED,
          assignedAt:            new Date(),
          assignmentDeadline:    deadline,
          assignmentAttemptCount: attemptNumber,
        },
      });

      // Create assignment history record
      await tx.applicationAssignment.create({
        data: {
          applicationId,
          agentId:       bestAgent.id,
          status:        AssignmentStatus.PENDING,
          deadlineAt:    deadline,
          attemptNumber,
          districtMatch: true,
        },
      });

      // Increment agent active cases
      await tx.agentMetrics.update({
        where: { agentId: bestAgent.id },
        data:  { activeCases: { increment: 1 } },
      });

      // Audit log
      await tx.auditLog.create({
        data: {
          action:       AuditAction.ASSIGNMENT,
          resourceType: 'Application',
          resourceId:   applicationId,
          newData: {
            agentId:      bestAgent.id,
            attemptNumber,
            deadline:     deadline.toISOString(),
          },
          success: true,
        },
      });

    });

    // Notify agent via FCM
    await QueueService.addNotificationJob({
      userId:   bestAgent.id,
      type:     'PUSH',
      title:    'New Job Assigned',
      message:  'You have a new application. Accept within 60 minutes.',
      fcmToken: bestAgent.fcmToken ?? undefined,
      data: {
        applicationId,
        type:     'NEW_ASSIGNMENT',
        deadline: deadline.toISOString(),
      },
    });

    logger.info({
      event:         'AGENT_ASSIGNED',
      applicationId,
      agentId:       bestAgent.id,
      attemptNumber,
      deadline:      deadline.toISOString(),
    });
  }
}