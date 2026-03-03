import { prisma } from '../../config/database';
import { AppError } from '../../core/AppError';
import { SuspensionStatus, UserRole } from '@prisma/client';
import logger from '../../core/logger';

export class EscalationService {

  //////////////////////////////////////////////////////
  // ESCALATE CASE (STRICT GOVERNANCE)
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
    // Status Validation
    //////////////////////////////////////////////////////

    if (
      suspensionCase.status !== SuspensionStatus.UNDER_REVIEW &&
      suspensionCase.status !== SuspensionStatus.CONFIRMED &&
      suspensionCase.status !== SuspensionStatus.ESCALATED &&
      suspensionCase.status !== SuspensionStatus.AUTO_ESCALATED
    ) {
      throw new AppError('Case not eligible for escalation', 400);
    }

    //////////////////////////////////////////////////////
    // Prevent Over Escalation
    //////////////////////////////////////////////////////

    if (suspensionCase.level >= 3) {
      throw new AppError('Already at highest governance level', 400);
    }

    //////////////////////////////////////////////////////
    // Authority Validation
    //////////////////////////////////////////////////////

    const escalator = await prisma.user.findUnique({
      where: { id: escalatedById },
    });

    if (!escalator) {
      throw new AppError('Escalator not found', 404);
    }

    // Level 1 → only STATE_ADMIN can escalate
    if (
      suspensionCase.level === 1 &&
      escalator.role !== UserRole.STATE_ADMIN
    ) {
      throw new AppError('Only State Admin can escalate level 1 cases', 403);
    }

    // Level 2 → only FOUNDER can escalate
    if (
      suspensionCase.level === 2 &&
      escalator.role !== UserRole.FOUNDER
    ) {
      throw new AppError('Only Founder can escalate level 2 cases', 403);
    }

    //////////////////////////////////////////////////////
    // Determine Next Level
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
    // Reset Deadline (New Review Window)
    //////////////////////////////////////////////////////

    const newDeadline = new Date(Date.now() + 48 * 60 * 60 * 1000);

    //////////////////////////////////////////////////////
    // Transaction Update
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
          action: 'UPDATE',
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

    logger.warn(
      `Case ${caseId} escalated → Level ${nextLevel} (${escalatedToRole})`
    );

    return {
      message: 'Case escalated successfully',
      level: nextLevel,
      escalatedTo: escalatedToRole,
    };
  }

}