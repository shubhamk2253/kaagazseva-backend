import cron from 'node-cron';
import { prisma } from '../config/database';
import { redis } from '../config/redis';
import { SuspensionStatus, UserRole } from '@prisma/client';
import logger from '../core/logger';

/**
 * KAAGAZSEVA - Auto Escalation Scheduler
 * Escalates unresolved suspension cases.
 */

export const startAutoEscalationJob = () => {

  logger.info('Auto Escalation Job Scheduled (Every 10 minutes)');

  cron.schedule('*/10 * * * *', async () => {

    const lockKey = 'auto-escalation-lock';

    try {

      //////////////////////////////////////////////////////
      // DISTRIBUTED LOCK (Prevents duplicate execution)
      //////////////////////////////////////////////////////

      const lock = await redis.set(
        lockKey,
        '1',
        'EX',
        600,
        'NX'
      );

      if (!lock) {
        logger.warn('Auto Escalation skipped (lock active)');
        return;
      }

      const now = new Date();

      //////////////////////////////////////////////////////
      // Fetch Authorities Once
      //////////////////////////////////////////////////////

      const stateAdmin = await prisma.user.findFirst({
        where: { role: UserRole.STATE_ADMIN },
      });

      const founder = await prisma.user.findFirst({
        where: { role: UserRole.FOUNDER },
      });

      //////////////////////////////////////////////////////
      // Fetch Expired Suspension Cases
      //////////////////////////////////////////////////////

      const expiredCases = await prisma.suspensionCase.findMany({
        where: {
          status: SuspensionStatus.UNDER_REVIEW,
          user: {
            suspensionReviewDeadline: {
              lt: now,
            },
          },
        },
        include: {
          user: true,
        },
      });

      if (!expiredCases.length) {

        logger.info({
          event: 'AUTO_ESCALATION_NONE'
        });

        return;
      }

      //////////////////////////////////////////////////////
      // Process Each Case
      //////////////////////////////////////////////////////

      for (const suspension of expiredCases) {

        if (suspension.level >= 3) continue;

        const nextLevel = suspension.level + 1;

        const authority =
          nextLevel === 2 ? stateAdmin : founder;

        if (!authority) continue;

        const newDeadline = new Date(
          Date.now() + 48 * 60 * 60 * 1000
        );

        await prisma.$transaction(async (tx) => {

          await tx.suspensionCase.update({
            where: { id: suspension.id },
            data: {
              level: nextLevel,
              status: SuspensionStatus.AUTO_ESCALATED,
              escalatedToId: authority.id,
            },
          });

          await tx.user.update({
            where: { id: suspension.userId },
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
              resourceId: suspension.userId,
              newData: {
                previousLevel: suspension.level,
                newLevel: nextLevel,
              },
              success: true,
            },
          });

        });

        logger.warn({
          event: 'AUTO_ESCALATION',
          userId: suspension.userId,
          level: nextLevel,
        });

      }

    } catch (error) {

      logger.error({
        event: 'AUTO_ESCALATION_FAILED',
        error
      });

    } finally {

      //////////////////////////////////////////////////////
      // Release lock
      //////////////////////////////////////////////////////

      await redis.del(lockKey);

    }

  });

};