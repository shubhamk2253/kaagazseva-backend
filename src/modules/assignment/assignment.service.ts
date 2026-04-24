import { prisma }               from '../../config/database';
import {
  ApplicationStatus,
  AssignmentStatus,
  AuditAction,
}                               from '@prisma/client';
import { AppError, ErrorCodes } from '../../core/AppError';
import { AgentPriorityEngine }  from './agent.priority.engine';
import { AssignmentEngine }     from './assignment.engine';
import logger                   from '../../core/logger';

/**
 * KAAGAZSEVA - Assignment Service
 * Handles agent accept/reject of assigned applications
 */

export class AssignmentService {

  /* =====================================================
     ACCEPT ASSIGNMENT
  ===================================================== */

  static async accept(
    applicationId: string,
    agentId:       string
  ) {
    await prisma.$transaction(async (tx) => {

      const application = await tx.application.findUnique({
        where: { id: applicationId },
      });

      if (!application) {
        throw AppError.notFound(
          'Application not found',
          ErrorCodes.APPLICATION_NOT_FOUND
        );
      }
      if (application.agentId !== agentId) {
        throw AppError.forbidden(
          'This application is not assigned to you',
          ErrorCodes.FORBIDDEN
        );
      }
      if (application.status !== ApplicationStatus.ASSIGNED) {
        throw new AppError(
          'Application is not awaiting acceptance',
          400, true, ErrorCodes.INVALID_STATUS_CHANGE
        );
      }
      if (
        application.assignmentDeadline &&
        application.assignmentDeadline < new Date()
      ) {
        throw new AppError(
          'Assignment acceptance window has expired',
          400, true, ErrorCodes.INVALID_STATUS_CHANGE
        );
      }

      // Update application status
      await tx.application.update({
        where: { id: applicationId },
        data: {
          status:             ApplicationStatus.ACCEPTED, // ✅
          acceptedAt:         new Date(),
          assignmentDeadline: null,
          // Update timeline milestone
          timeline: {
            update: { acceptedAt: new Date() },
          },
        },
      });

      // Update assignment history record
      await tx.applicationAssignment.updateMany({
        where: {
          applicationId,
          agentId,
          status: AssignmentStatus.PENDING,
        },
        data: {
          status:      AssignmentStatus.ACCEPTED,
          respondedAt: new Date(),
        },
      });

      // Audit log
      await tx.auditLog.create({
        data: {
          userId:       agentId,
          action:       AuditAction.STATUS_CHANGE,
          resourceType: 'Application',
          resourceId:   applicationId,
          oldData:      { status: ApplicationStatus.ASSIGNED },
          newData:      { status: ApplicationStatus.ACCEPTED },
          success:      true,
        },
      });
    });

    // Recalculate agent priority score
    await AgentPriorityEngine.recalculate(agentId);

    logger.info({
      event:         'ASSIGNMENT_ACCEPTED',
      applicationId,
      agentId,
    });

    return { message: 'Assignment accepted successfully' };
  }

  /* =====================================================
     REJECT ASSIGNMENT
  ===================================================== */

  static async reject(
    applicationId: string,
    agentId:       string,
    reason?:       string
  ) {
    await prisma.$transaction(async (tx) => {

      const application = await tx.application.findUnique({
        where: { id: applicationId },
      });

      if (!application) {
        throw AppError.notFound(
          'Application not found',
          ErrorCodes.APPLICATION_NOT_FOUND
        );
      }
      if (application.agentId !== agentId) {
        throw AppError.forbidden(
          'This application is not assigned to you',
          ErrorCodes.FORBIDDEN
        );
      }
      if (application.status !== ApplicationStatus.ASSIGNED) {
        throw new AppError(
          'Application is not awaiting acceptance',
          400, true, ErrorCodes.INVALID_STATUS_CHANGE
        );
      }

      // 1. Update assignment history → REJECTED
      await tx.applicationAssignment.updateMany({
        where: {
          applicationId,
          agentId,
          status: AssignmentStatus.PENDING,
        },
        data: {
          status:         AssignmentStatus.REJECTED,
          respondedAt:    new Date(),
          responseReason: reason,
        },
      });

      // 2. Penalise agent
      await tx.agentMetrics.update({
        where: { agentId },
        data: {
          rejectionCount: { increment: 1 },
          activeCases:    { decrement: 1 },
        },
      });

      // 3. Reset application for reassignment
      await tx.application.update({
        where: { id: applicationId },
        data: {
          agentId:            null,
          status:             ApplicationStatus.ASSIGNING, // ✅
          assignmentDeadline: null,
          acceptedAt:         null,
        },
      });

      // 4. Audit log
      await tx.auditLog.create({
        data: {
          userId:       agentId,
          action:       AuditAction.STATUS_CHANGE,
          resourceType: 'Application',
          resourceId:   applicationId,
          oldData:      { status: ApplicationStatus.ASSIGNED, agentId },
          newData:      { status: ApplicationStatus.ASSIGNING, reason },
          success:      true,
        },
      });
    });

    // Recalculate priority after penalty
    await AgentPriorityEngine.recalculate(agentId);

    // Immediate reassignment
    try {
      await AssignmentEngine.autoAssign(applicationId);
    } catch (err: any) {
      logger.error({
        event:         'REASSIGNMENT_FAILED',
        applicationId,
        error:         err.message,
      });
    }

    logger.info({
      event:         'ASSIGNMENT_REJECTED',
      applicationId,
      agentId,
      reason,
    });

    return { message: 'Assignment rejected. Finding next available agent.' };
  }
}