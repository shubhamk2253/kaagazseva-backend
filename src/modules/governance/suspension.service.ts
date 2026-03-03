import { prisma } from '../../config/database';
import { AppError } from '../../core/AppError';
import { UserRole, SuspensionStatus } from '@prisma/client';
import logger from '../../core/logger';

export class SuspensionService {

  //////////////////////////////////////////////////////
  // 1️⃣ INITIATE SUSPENSION (DISTRICT / STATE / FOUNDER)
  //////////////////////////////////////////////////////

  static async initiateSuspension(
    targetAgentId: string,
    reason: string,
    performedById: string,
    performerRole: UserRole
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

    const agent = await prisma.user.findUnique({
      where: { id: targetAgentId },
    });

    if (!agent || agent.role !== UserRole.AGENT) {
      throw new AppError('Invalid agent', 400);
    }

    if (agent.suspensionStatus !== SuspensionStatus.NONE) {
      throw new AppError('Suspension already in progress', 400);
    }

    await prisma.$transaction(async (tx) => {

      await tx.user.update({
        where: { id: targetAgentId },
        data: {
          suspensionStatus: SuspensionStatus.PENDING,
          suspensionReason: reason,
          suspendedBy: performedById,
          suspendedAt: new Date(),
        },
      });

      await tx.auditLog.create({
        data: {
          userId: performedById,
          action: 'CREATE',
          resourceType: 'SUSPENSION_INITIATED',
          resourceId: targetAgentId,
          newData: { reason },
          success: true,
        },
      });

    });

    logger.warn(`⚠ Suspension initiated → ${targetAgentId}`);

    return { message: 'Suspension initiated (Pending confirmation)' };
  }

  //////////////////////////////////////////////////////
  // 2️⃣ CONFIRM SUSPENSION (STATE_ADMIN / FOUNDER)
  //////////////////////////////////////////////////////

  static async confirmSuspension(
    targetAgentId: string,
    performedById: string,
    performerRole: UserRole
  ) {

    if (
      performerRole !== UserRole.STATE_ADMIN &&
      performerRole !== UserRole.FOUNDER
    ) {
      throw new AppError('Only State Admin or Founder can confirm', 403);
    }

    const agent = await prisma.user.findUnique({
      where: { id: targetAgentId },
      include: { wallet: true },
    });

    if (!agent || agent.suspensionStatus !== SuspensionStatus.PENDING) {
      throw new AppError('No pending suspension found', 400);
    }

    await prisma.$transaction(async (tx) => {

      await tx.user.update({
        where: { id: targetAgentId },
        data: {
          suspensionStatus: SuspensionStatus.CONFIRMED,
          isSuspended: true,
        },
      });

      if (agent.wallet) {
        await tx.wallet.update({
          where: { userId: targetAgentId },
          data: { isFrozen: true },
        });
      }

      await tx.auditLog.create({
        data: {
          userId: performedById,
          action: 'UPDATE',
          resourceType: 'SUSPENSION_CONFIRMED',
          resourceId: targetAgentId,
          success: true,
        },
      });

    });

    logger.warn(`🚨 Suspension confirmed → ${targetAgentId}`);

    return { message: 'Suspension confirmed and wallet frozen' };
  }

  //////////////////////////////////////////////////////
  // 3️⃣ REVERSE SUSPENSION (FOUNDER ONLY)
  //////////////////////////////////////////////////////

  static async reverseSuspension(
    targetAgentId: string,
    performedById: string,
    performerRole: UserRole
  ) {

    if (performerRole !== UserRole.FOUNDER) {
      throw new AppError('Only Founder can reverse suspension', 403);
    }

    const agent = await prisma.user.findUnique({
      where: { id: targetAgentId },
      include: { wallet: true },
    });

    if (!agent || agent.suspensionStatus === SuspensionStatus.NONE) {
      throw new AppError('No suspension exists', 400);
    }

    await prisma.$transaction(async (tx) => {

      await tx.user.update({
        where: { id: targetAgentId },
        data: {
          suspensionStatus: SuspensionStatus.NONE,
          isSuspended: false,
          suspensionReason: null,
          suspendedBy: null,
          suspendedAt: null,
        },
      });

      if (agent.wallet) {
        await tx.wallet.update({
          where: { userId: targetAgentId },
          data: { isFrozen: false },
        });
      }

      await tx.auditLog.create({
        data: {
          userId: performedById,
          action: 'UPDATE',
          resourceType: 'SUSPENSION_REVERSED',
          resourceId: targetAgentId,
          success: true,
        },
      });

    });

    logger.info(`✅ Suspension reversed → ${targetAgentId}`);

    return { message: 'Suspension reversed successfully' };
  }
}