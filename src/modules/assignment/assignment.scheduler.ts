import cron              from 'node-cron';
import { prisma }        from '../../config/database';
import { redis }         from '../../config/redis';
import {
  ApplicationStatus,
  AssignmentStatus,
  AuditAction,
}                        from '@prisma/client';
import { AssignmentEngine } from './assignment.engine';
import logger            from '../../core/logger';

/**
 * KAAGAZSEVA - Assignment Timeout Scheduler
 * Runs every 5 minutes (IST)
 * Handles expired agent assignments — penalise + reassign
 */

const LOCK_KEY     = 'lock:assignment-scheduler';
const LOCK_TTL_SEC = 270; // 4.5 min (cron runs every 5)

export class AssignmentScheduler {

  static start(): cron.ScheduledTask {

    logger.info({ event: 'ASSIGNMENT_SCHEDULER_STARTED' });

    const task = cron.schedule('*/5 * * * *', async () => {

      // Distributed lock
      const lock = await redis.set(
        LOCK_KEY, '1', 'EX', LOCK_TTL_SEC, 'NX'
      );

      if (!lock) {
        logger.debug({ event: 'ASSIGNMENT_SCHEDULER_SKIPPED', reason: 'lock_active' });
        return;
      }

      logger.info({ event: 'ASSIGNMENT_SCHEDULER_TRIGGERED' });

      try {

        // Find all expired ASSIGNED applications
        const expired = await prisma.application.findMany({
          where: {
            status:             ApplicationStatus.ASSIGNED,
            assignmentDeadline: { lt: new Date() },
          },
          select: { id: true },
        });

        if (!expired.length) {
          logger.info({ event: 'ASSIGNMENT_SCHEDULER_NONE_EXPIRED' });
          await redis.del(LOCK_KEY); // release on clean run
          return;
        }

        logger.warn({
          event: 'ASSIGNMENT_TIMEOUTS_FOUND',
          count: expired.length,
        });

        let processed = 0;
        let skipped   = 0;

        for (const app of expired) {
          try {

            let shouldReassign = false;

            await prisma.$transaction(async (tx) => {

              // Re-fetch inside transaction — status may have changed
              const current = await tx.application.findUnique({
                where: { id: app.id },
              });

              if (
                !current ||
                current.status !== ApplicationStatus.ASSIGNED
              ) {
                skipped++;
                return;
              }

              // Skip manually flagged applications
              if (current.manualReview) {
                skipped++;
                return;
              }

              // 1. Mark assignment record as TIMEOUT
              if (current.agentId) {
                await tx.applicationAssignment.updateMany({
                  where: {
                    applicationId: app.id,
                    agentId:       current.agentId,
                    status:        AssignmentStatus.PENDING,
                  },
                  data: {
                    status:      AssignmentStatus.TIMEOUT,
                    respondedAt: new Date(),
                  },
                });

                // 2. Penalise agent
                await tx.agentMetrics.update({
                  where: { agentId: current.agentId },
                  data: {
                    timeoutCount: { increment: 1 },
                    activeCases:  { decrement: 1 },
                  },
                });
              }

              const nextLevel = current.escalationLevel + 1;

              // 3. Level 4+ → escalate to admin
              if (nextLevel >= 4) {
                await tx.application.update({
                  where: { id: app.id },
                  data: {
                    status:             ApplicationStatus.ON_HOLD, // ✅
                    manualReview:       true,
                    agentId:            null,
                    escalationLevel:    4,
                    assignmentDeadline: null,
                    assignedAt:         null,
                    acceptedAt:         null,
                  },
                });

                await tx.auditLog.create({
                  data: {
                    action:       AuditAction.STATUS_CHANGE,
                    resourceType: 'Application',
                    resourceId:   app.id,
                    oldData:      { status: ApplicationStatus.ASSIGNED },
                    newData:      { status: ApplicationStatus.ON_HOLD, reason: 'max_escalation' },
                    success:      true,
                  },
                });

                logger.error({
                  event:         'ASSIGNMENT_MAX_ESCALATION',
                  applicationId: app.id,
                });

                skipped++;
                return;
              }

              // 4. Reset for reassignment
              await tx.application.update({
                where: { id: app.id },
                data: {
                  agentId:            null,
                  escalationLevel:    nextLevel,
                  status:             ApplicationStatus.ASSIGNING, // ✅
                  assignmentDeadline: null,
                  assignedAt:         null,
                  acceptedAt:         null,
                },
              });

              shouldReassign = true;
            });

            if (shouldReassign) {
              await AssignmentEngine.autoAssign(app.id);

              logger.info({
                event:         'ASSIGNMENT_REASSIGNED',
                applicationId: app.id,
              });

              processed++;
            }

          } catch (appError: any) {
            logger.error({
              event:         'ASSIGNMENT_TIMEOUT_FAILED',
              applicationId: app.id,
              error:         appError.message,
            });
            skipped++;
          }
        }

        logger.info({
          event:     'ASSIGNMENT_SCHEDULER_COMPLETE',
          processed,
          skipped,
          total:     expired.length,
        });

        // Release lock on success
        await redis.del(LOCK_KEY);

      } catch (error: any) {
        logger.error({
          event: 'ASSIGNMENT_SCHEDULER_FAILED',
          error: error.message,
        });
        // Lock expires naturally on failure
      }

    }, {
      timezone: 'Asia/Kolkata',
    });

    return task;
  }
}