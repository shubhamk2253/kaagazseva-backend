import { prisma } from '../../config/database';
import { ApplicationStatus } from '@prisma/client';
import { AppError } from '../../core/AppError';
import { AgentPriorityEngine } from './agent.priority.engine';
import { AssignmentEngine } from './assignment.engine';

export class AssignmentService {

  //////////////////////////////////////////////////////
  // 1️⃣ ACCEPT ASSIGNMENT
  //////////////////////////////////////////////////////

  static async accept(applicationId: string, agentId: string) {

    await prisma.$transaction(async (tx) => {

      const application = await tx.application.findUnique({
        where: { id: applicationId },
      });

      if (!application) {
        throw new AppError('Application not found', 404);
      }

      if (application.agentId !== agentId) {
        throw new AppError('Unauthorized assignment', 403);
      }

      if (application.status !== ApplicationStatus.ASSIGNED) {
        throw new AppError('Application not in assignable state', 400);
      }

      if (
        application.assignmentDeadline &&
        application.assignmentDeadline < new Date()
      ) {
        throw new AppError('Assignment expired', 400);
      }

      await tx.application.update({
        where: { id: applicationId },
        data: {
          status: ApplicationStatus.UNDER_REVIEW,
          acceptedAt: new Date(),
          assignmentDeadline: null,
        },
      });

    });

    await AgentPriorityEngine.recalculate(agentId);

    return { message: 'Assignment accepted successfully' };
  }

  //////////////////////////////////////////////////////
  // 2️⃣ REJECT ASSIGNMENT (Immediate Reassign)
  //////////////////////////////////////////////////////

  static async reject(applicationId: string, agentId: string) {

    await prisma.$transaction(async (tx) => {

      const application = await tx.application.findUnique({
        where: { id: applicationId },
      });

      if (!application) {
        throw new AppError('Application not found', 404);
      }

      if (application.agentId !== agentId) {
        throw new AppError('Unauthorized rejection', 403);
      }

      if (application.status !== ApplicationStatus.ASSIGNED) {
        throw new AppError('Application not in assignable state', 400);
      }

      // 1️⃣ Penalize Agent
      await tx.agentMetrics.update({
        where: { agentId },
        data: {
          rejectionCount: { increment: 1 },
          activeCases: { decrement: 1 },
        },
      });

      // 2️⃣ Reset Application
      await tx.application.update({
        where: { id: applicationId },
        data: {
          agentId: null,
          status: ApplicationStatus.SUBMITTED,
          assignmentDeadline: null,
          acceptedAt: null,
        },
      });

    });

    // 🔁 Recalculate priority
    await AgentPriorityEngine.recalculate(agentId);

    // 🚀 Immediate Reassignment
    try {
      await AssignmentEngine.autoAssign(applicationId);
    } catch (err) {
      // If no agent available → manualReview handled inside engine
    }

    return { message: 'Rejected and reassigned immediately' };
  }
}