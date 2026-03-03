import cron from 'node-cron';
import { prisma } from '../config/database';
import { SuspensionStatus, UserRole } from '@prisma/client';
import logger from '../core/logger';

///////////////////////////////////////////////////////////
// AUTO ESCALATION JOB
// Runs every 10 minutes
///////////////////////////////////////////////////////////

cron.schedule('*/10 * * * *', async () => {
  try {

    const now = new Date();

    //////////////////////////////////////////////////////
    // Find expired suspension reviews
    //////////////////////////////////////////////////////

    const expiredUsers = await prisma.user.findMany({
      where: {
        suspensionStatus: SuspensionStatus.UNDER_REVIEW,
        suspensionReviewDeadline: {
          lt: now,
        },
      },
    });

    if (!expiredUsers.length) {
      return;
    }

    for (const user of expiredUsers) {

      const activeCase = await prisma.suspensionCase.findFirst({
        where: {
          userId: user.id,
          status: SuspensionStatus.UNDER_REVIEW,
        },
      });

      if (!activeCase) continue;

      //////////////////////////////////////////////////////
      // Prevent escalation beyond Level 3
      //////////////////////////////////////////////////////

      if (activeCase.level >= 3) continue;

      const nextLevel = activeCase.level + 1;

      const escalatedToRole =
        nextLevel === 2
          ? UserRole.STATE_ADMIN
          : UserRole.FOUNDER;

      const escalatedAuthority = await prisma.user.findFirst({
        where: { role: escalatedToRole },
      });

      if (!escalatedAuthority) continue;

      const newDeadline = new Date(
        Date.now() + 48 * 60 * 60 * 1000
      );

      //////////////////////////////////////////////////////
      // Transaction
      //////////////////////////////////////////////////////

      await prisma.$transaction(async (tx) => {

        await tx.suspensionCase.update({
          where: { id: activeCase.id },
          data: {
            level: nextLevel,
            status: SuspensionStatus.AUTO_ESCALATED,
            escalatedToId: escalatedAuthority.id,
          },
        });

        await tx.user.update({
          where: { id: user.id },
          data: {
            suspensionLevel: nextLevel,
            suspensionStatus: SuspensionStatus.AUTO_ESCALATED,
            suspensionReviewDeadline: newDeadline,
          },
        });

        await tx.auditLog.create({
          data: {
            action: 'UPDATE',
            resourceType: 'AUTO_ESCALATION',
            resourceId: user.id,
            newData: {
              previousLevel: activeCase.level,
              newLevel: nextLevel,
            },
            success: true,
          },
        });

      });

      logger.warn(
        `AUTO ESCALATION → User ${user.id} moved to level ${nextLevel}`
      );

    }

  } catch (error) {
    logger.error('Auto Escalation Job Failed', error);
  }
});