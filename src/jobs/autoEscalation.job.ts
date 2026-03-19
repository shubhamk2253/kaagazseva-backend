import cron              from 'node-cron';
import { prisma }        from '../config/database';
import { redis }         from '../config/redis';
import {
  SuspensionStatus,
  UserRole,
  AuditAction,
}                        from '@prisma/client';
import logger            from '../core/logger';

/**
 * KAAGAZSEVA - Auto Escalation Scheduler
 * Runs every 10 minutes.
 * Escalates unresolved suspension cases to correct authority.
 * Uses distributed Redis lock to prevent duplicate execution.
 */

const LOCK_KEY     = 'lock:auto-escalation';
const LOCK_TTL_SEC = 540; // 9 minutes (cron runs every 10)
const MAX_LEVEL    = 3;
const DEADLINE_MS  = 48 * 60 * 60 * 1000; // 48 hours

export const startAutoEscalationJob = (): cron.ScheduledTask => {

  logger.info({ event: 'AUTO_ESCALATION_JOB_SCHEDULED' });

  const task = cron.schedule('*/10 * * * *', async () => {

    /* =====================================================
       DISTRIBUTED LOCK
       Prevents duplicate execution across instances
    ===================================================== */

    const lock = await redis.set(LOCK_KEY, '1', 'EX', LOCK_TTL_SEC, 'NX');

    if (!lock) {
      logger.debug({ event: 'AUTO_ESCALATION_SKIPPED', reason: 'lock_active' });
      return;
    }

    logger.info({ event: 'AUTO_ESCALATION_STARTED' });

    try {

      const now = new Date();

      /* =====================================================
         FETCH FOUNDER ONCE — same across all states
      ===================================================== */

      const founder = await prisma.user.findFirst({
        where: { role: UserRole.FOUNDER },
      });

      /* =====================================================
         FETCH EXPIRED CASES
      ===================================================== */

      const expiredCases = await prisma.suspensionCase.findMany({
        where: {
          status: SuspensionStatus.UNDER_REVIEW,
          user: {
            suspensionReviewDeadline: { lt: now },
          },
        },
        include: {
          user: {
            select: {
              id:       true,
              stateId:  true,
              name:     true,
            },
          },
        },
      });

      if (!expiredCases.length) {
        logger.info({ event: 'AUTO_ESCALATION_NONE' });
        return;
      }

      logger.info({
        event: 'AUTO_ESCALATION_PROCESSING',
        total: expiredCases.length,
      });

      let processed = 0;
      let skipped   = 0;

      /* =====================================================
         PROCESS EACH CASE
      ===================================================== */

      for (const suspension of expiredCases) {

        // Already at max level — skip
        if (suspension.level >= MAX_LEVEL) {
          skipped++;
          continue;
        }

        const nextLevel   = suspension.level + 1;
        const newDeadline = new Date(Date.now() + DEADLINE_MS);

        // Level 2 → escalate to state admin (correct state)
        // Level 3 → escalate to founder
        let authority = null;

        if (nextLevel === 2) {
          authority = await prisma.user.findFirst({
            where: {
              role:    UserRole.STATE_ADMIN,
              stateId: suspension.user.stateId ?? undefined,
            },
          });

          if (!authority) {
            // Fallback to founder if no state admin
            authority = founder;
          }
        } else {
          authority = founder;
        }

        if (!authority) {
          logger.error({
            event:  'AUTO_ESCALATION_NO_AUTHORITY',
            userId: suspension.userId,
            level:  nextLevel,
          });
          skipped++;
          continue;
        }

        try {
          await prisma.$transaction(async (tx) => {

            await tx.suspensionCase.update({
              where: { id: suspension.id },
              data: {
                level:         nextLevel,
                status:        SuspensionStatus.AUTO_ESCALATED,
                escalatedToId: authority!.id,
              },
            });

            await tx.user.update({
              where: { id: suspension.userId },
              data: {
                suspensionLevel:          nextLevel,
                suspensionStatus:         SuspensionStatus.AUTO_ESCALATED,
                suspensionReviewDeadline: newDeadline,
              },
            });

            await tx.auditLog.create({
              data: {
                action:       AuditAction.STATUS_CHANGE,
                resourceType: 'SuspensionCase',
                resourceId:   suspension.id,
                oldData: {
                  level:  suspension.level,
                  status: SuspensionStatus.UNDER_REVIEW,
                },
                newData: {
                  level:         nextLevel,
                  status:        SuspensionStatus.AUTO_ESCALATED,
                  escalatedToId: authority!.id,
                },
                success: true,
              },
            });

          });

          logger.warn({
            event:         'AUTO_ESCALATION_PROCESSED',
            userId:        suspension.userId,
            previousLevel: suspension.level,
            newLevel:      nextLevel,
            escalatedTo:   authority.id,
          });

          processed++;

        } catch (caseError: any) {
          // Log per-case error but continue processing others
          logger.error({
            event:        'AUTO_ESCALATION_CASE_FAILED',
            suspensionId: suspension.id,
            userId:       suspension.userId,
            error:        caseError.message,
          });
          skipped++;
        }
      }

      logger.info({
        event:     'AUTO_ESCALATION_COMPLETE',
        processed,
        skipped,
        total:     expiredCases.length,
      });

    } catch (error: any) {
      logger.error({
        event: 'AUTO_ESCALATION_FAILED',
        error: error.message,
      });
      // Lock expires naturally — prevents re-run of failed job
    }

  });

  return task;
};