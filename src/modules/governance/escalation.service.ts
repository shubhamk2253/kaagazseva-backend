import { prisma } from '../../config/database';
import { AppError } from '../../core/AppError';
import { SuspensionStatus, UserRole, AuditAction } from '@prisma/client';
import logger from '../../core/logger';

const ESCALATION_REVIEW_HOURS = 48;

export class EscalationService {

  //////////////////////////////////////////////////////
  // ESCALATE CASE
  //////////////////////////////////////////////////////

  static async escalate(
    caseId: string,
    escalatedById: string
  ) {

    const suspensionCase = await prisma.suspensionCase.findUnique({
      where: { id: caseId },
      include: { user: true },
    });

    if (!suspensionCase) {
      throw new AppError('Suspension case not found', 404);
    }

    //////////////////////////////////////////////////////
    // STATUS VALIDATION
    //////////////////////////////////////////////////////

    const allowedStatuses: SuspensionStatus[] = [
      SuspensionStatus.UNDER_REVIEW,
      SuspensionStatus.CONFIRMED,
      SuspensionStatus.ESCALATED,
      SuspensionStatus.AUTO_ESCALATED,
    ];

    if (!allowedStatuses.includes(suspensionCase.status)) {
      throw new AppError('Case not eligible for escalation', 400);
    }

    //////////////////////////////////////////////////////
    // PREVENT OVER ESCALATION
    //////////////////////////////////////////////////////

    if (suspensionCase.level >= 3) {
      throw new AppError('Already at highest governance level', 400);
    }

    //////////////////////////////////////////////////////
    // ESCALATOR VALIDATION
    //////////////////////////////////////////////////////

    const escalator = await prisma.user.findUnique({
      where: { id: escalatedById },
    });

    if (!escalator) {
      throw new AppError('Escalator not found', 404);
    }

    if (
      suspensionCase.level === 1 &&
      escalator.role !== UserRole.STATE_ADMIN
    ) {
      throw new AppError(
        'Only State Admin can escalate level 1 cases',
        403
      );
    }

    if (
      suspensionCase.level === 2 &&
      escalator.role !== UserRole.FOUNDER
    ) {
      throw new AppError(
        'Only Founder can escalate level 2 cases',
        403
      );
    }

    //////////////////////////////////////////////////////
    // NEXT LEVEL
    //////////////////////////////////////////////////////

    const nextLevel = suspensionCase.level + 1;

    const escalatedToRole =
      nextLevel === 2
        ? UserRole.STATE_ADMIN
        : UserRole.FOUNDER;

    const escalatedAuthority = await prisma.user.findFirst({
      where: { role: escalatedToRole },
    });

    if (!escalatedAuthority) {
      throw new AppError('Escalation authority not found', 500);
    }

    //////////////////////////////////////////////////////
    // NEW DEADLINE
    //////////////////////////////////////////////////////

    const newDeadline = new Date(
      Date.now() + ESCALATION_REVIEW_HOURS * 60 * 60 * 1000
    );

    //////////////////////////////////////////////////////
    // TRANSACTION
    //////////////////////////////////////////////////////

    await prisma.$transaction(async (tx) => {

      await tx.suspensionCase.update({
        where: { id: caseId },
        data: {
          level: nextLevel,
          status: SuspensionStatus.ESCALATED,
          escalatedToId: escalatedAuthority.id,
        },
      });

      await tx.user.update({
        where: { id: suspensionCase.userId },
        data: {
          suspensionLevel: nextLevel,
          suspensionStatus: SuspensionStatus.ESCALATED,
          suspensionReviewDeadline: newDeadline,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: escalatedById,
          action: AuditAction.UPDATE,
          resourceType: 'SUSPENSION_ESCALATED',
          resourceId: suspensionCase.userId,
          newData: {
            previousLevel: suspensionCase.level,
            newLevel: nextLevel,
          },
          success: true,
        },
      });

    });

    //////////////////////////////////////////////////////
    // LOGGING
    //////////////////////////////////////////////////////

    logger.warn({
      event: 'CASE_ESCALATED',
      caseId,
      newLevel: nextLevel,
      escalatedTo: escalatedToRole,
      escalatedBy: escalatedById,
    });

    return {
      message: 'Case escalated successfully',
      level: nextLevel,
      escalatedTo: escalatedToRole,
    };

  }

}