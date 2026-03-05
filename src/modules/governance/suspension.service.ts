import { prisma } from '../../config/database';
import { AppError } from '../../core/AppError';
import { UserRole, SuspensionStatus, AuditAction } from '@prisma/client';
import logger from '../../core/logger';

export class SuspensionService {

  //////////////////////////////////////////////////////
  // 1️⃣ INITIATE (DISTRICT / STATE / FOUNDER)
  //////////////////////////////////////////////////////

  static async initiate(
    targetUserId: string,
    reason: string,
    initiatedById: string,
    performerRole: UserRole,
    evidence?: string | string[]
  ) {

    if (!reason || reason.length < 5) {
      throw new AppError('Valid suspension reason required', 400);
    }

    if (
      performerRole !== UserRole.DISTRICT_ADMIN &&
      performerRole !== UserRole.STATE_ADMIN &&
      performerRole !== UserRole.FOUNDER
    ) {
      throw new AppError('Unauthorized governance action', 403);
    }

    const target = await prisma.user.findUnique({
      where: { id: targetUserId },
      include: { wallet: true },
    });

    if (!target || target.role !== UserRole.AGENT) {
      throw new AppError('Invalid agent', 400);
    }

    if (target.suspensionStatus !== SuspensionStatus.NONE) {
      throw new AppError('Suspension already active', 400);
    }

    const level =
      performerRole === UserRole.DISTRICT_ADMIN
        ? 1
        : performerRole === UserRole.STATE_ADMIN
        ? 2
        : 3;

    const deadline = new Date(Date.now() + 48 * 60 * 60 * 1000);

    await prisma.$transaction(async (tx) => {

      //////////////////////////////////////////////////////
      // Create Suspension Case
      //////////////////////////////////////////////////////

      await tx.suspensionCase.create({
        data: {
          userId: targetUserId,
          initiatedById,
          reason,
          evidence,
          level,
          status: SuspensionStatus.UNDER_REVIEW,
        },
      });

      //////////////////////////////////////////////////////
      // Update User Suspension State
      //////////////////////////////////////////////////////

      await tx.user.update({
        where: { id: targetUserId },
        data: {
          suspensionStatus: SuspensionStatus.UNDER_REVIEW,
          isSuspended: true,
          suspensionLevel: level,
          suspensionReviewDeadline: deadline,
        },
      });

      //////////////////////////////////////////////////////
      // Freeze Wallet
      //////////////////////////////////////////////////////

      if (target.wallet) {
        await tx.wallet.updateMany({
          where: { userId: targetUserId },
          data: { isFrozen: true },
        });
      }

      //////////////////////////////////////////////////////
      // Audit Log
      //////////////////////////////////////////////////////

      await tx.auditLog.create({
        data: {
          userId: initiatedById,
          action: AuditAction.CREATE,
          resourceType: 'SUSPENSION_INITIATED',
          resourceId: targetUserId,
          newData: { reason, level },
          success: true,
        },
      });

    });

    logger.warn({
      event: 'SUSPENSION_INITIATED',
      targetUserId,
      initiatedById,
      role: performerRole,
    });

    return {
      message: 'Suspension under review & wallet frozen',
    };
  }

  //////////////////////////////////////////////////////
  // 2️⃣ REVIEW (STRICT HIERARCHY ENFORCED)
  //////////////////////////////////////////////////////

  static async review(
    caseId: string,
    reviewerId: string,
    decision: 'CONFIRM' | 'REJECT'
  ) {

    const suspensionCase = await prisma.suspensionCase.findUnique({
      where: { id: caseId },
      include: { user: true },
    });

    if (!suspensionCase) {
      throw new AppError('Case not found', 404);
    }

    const allowedStatuses: SuspensionStatus[] = [
      SuspensionStatus.UNDER_REVIEW,
      SuspensionStatus.ESCALATED,
      SuspensionStatus.AUTO_ESCALATED,
    ];

    if (!allowedStatuses.includes(suspensionCase.status)) {
      throw new AppError('Case not eligible for review', 400);
    }

    const reviewer = await prisma.user.findUnique({
      where: { id: reviewerId },
    });

    if (!reviewer) {
      throw new AppError('Reviewer not found', 404);
    }

    //////////////////////////////////////////////////////
    // Strict Level-Based Authority
    //////////////////////////////////////////////////////

    if (
      suspensionCase.level === 1 &&
      reviewer.role !== UserRole.STATE_ADMIN
    ) {
      throw new AppError(
        'Only State Admin can review level 1 cases',
        403
      );
    }

    if (
      suspensionCase.level >= 2 &&
      reviewer.role !== UserRole.FOUNDER
    ) {
      throw new AppError(
        'Only Founder can review level 2+ cases',
        403
      );
    }

    await prisma.$transaction(async (tx) => {

      //////////////////////////////////////////////////////
      // CONFIRM
      //////////////////////////////////////////////////////

      if (decision === 'CONFIRM') {

        await tx.suspensionCase.update({
          where: { id: caseId },
          data: {
            status: SuspensionStatus.CONFIRMED,
            resolvedById: reviewerId,
          },
        });

        await tx.user.update({
          where: { id: suspensionCase.userId },
          data: {
            suspensionStatus: SuspensionStatus.CONFIRMED,
            suspensionReviewDeadline: null,
          },
        });

      }

      //////////////////////////////////////////////////////
      // REJECT
      //////////////////////////////////////////////////////

      else {

        await tx.suspensionCase.update({
          where: { id: caseId },
          data: {
            status: SuspensionStatus.REJECTED,
            resolvedById: reviewerId,
          },
        });

        await tx.user.update({
          where: { id: suspensionCase.userId },
          data: {
            suspensionStatus: SuspensionStatus.NONE,
            isSuspended: false,
            suspensionLevel: 0,
            suspensionReviewDeadline: null,
          },
        });

        await tx.wallet.updateMany({
          where: { userId: suspensionCase.userId },
          data: { isFrozen: false },
        });

      }

      //////////////////////////////////////////////////////
      // Audit Log
      //////////////////////////////////////////////////////

      await tx.auditLog.create({
        data: {
          userId: reviewerId,
          action: AuditAction.UPDATE,
          resourceType: 'SUSPENSION_REVIEW',
          resourceId: suspensionCase.userId,
          newData: { decision },
          success: true,
        },
      });

    });

    logger.info({
      event: 'SUSPENSION_REVIEW',
      caseId,
      reviewerId,
      decision,
    });

    return {
      message: `Suspension ${decision}`,
    };
  }

  //////////////////////////////////////////////////////
  // 3️⃣ APPEAL (AGENT → ESCALATION)
  //////////////////////////////////////////////////////

  static async appeal(
    caseId: string,
    agentId: string,
    message: string
  ) {

    if (!message || message.length < 5) {
      throw new AppError('Valid appeal message required', 400);
    }

    const suspensionCase = await prisma.suspensionCase.findUnique({
      where: { id: caseId },
    });

    if (!suspensionCase) {
      throw new AppError('Case not found', 404);
    }

    if (suspensionCase.userId !== agentId) {
      throw new AppError('Unauthorized', 403);
    }

    if (suspensionCase.status !== SuspensionStatus.CONFIRMED) {
      throw new AppError(
        'Only confirmed suspensions can be appealed',
        400
      );
    }

    if (suspensionCase.appealAt) {
      throw new AppError('Appeal already submitted', 400);
    }

    await prisma.suspensionCase.update({
      where: { id: caseId },
      data: {
        status: SuspensionStatus.ESCALATED,
        appealMessage: message,
        appealAt: new Date(),
      },
    });

    logger.info({
      event: 'SUSPENSION_APPEAL',
      caseId,
      agentId,
    });

    return {
      message: 'Appeal submitted successfully',
    };
  }

}