import cron from 'node-cron';
import { prisma } from '../../config/database';
import { redis } from '../../config/redis';
import { ApplicationStatus } from '@prisma/client';
import { AssignmentEngine } from './assignment.engine';
import logger from '../../core/logger';

/**
 * KAAGAZSEVA - Assignment Escalation Scheduler
 * Enterprise-safe with escalation ladder support
 */

export class AssignmentScheduler {

  static start() {

    logger.info('🕒 Assignment Scheduler Started');

    cron.schedule('*/5 * * * *', async () => {

      const lock = await redis.set(
        'assignment_scheduler_lock',
        'locked',
        'EX',
        60,
        'NX'
      );

      if (!lock) {
        return;
      }

      try {

        logger.info('🔎 Checking expired assignments...');

        const expiredApplications = await prisma.application.findMany({
          where: {
            status: ApplicationStatus.ASSIGNED,
            assignmentDeadline: {
              lt: new Date(),
            },
          },
          select: {
            id: true,
          },
        });

        if (!expiredApplications.length) {
          return;
        }

        logger.warn(
          `⚠ Found ${expiredApplications.length} expired assignments`
        );

        for (const app of expiredApplications) {

          try {

            let shouldReassign = false;

            await prisma.$transaction(async (tx) => {

              const current = await tx.application.findUnique({
                where: { id: app.id },
              });

              if (
                !current ||
                current.status !== ApplicationStatus.ASSIGNED
              ) {
                return;
              }

              if (current.manualReview) {
                return;
              }

              //////////////////////////////////////////////////////
              // 1️⃣ Penalize Agent
              //////////////////////////////////////////////////////

              if (current.agentId) {
                await tx.agentMetrics.update({
                  where: { agentId: current.agentId },
                  data: {
                    timeoutCount: { increment: 1 },
                    activeCases: { decrement: 1 },
                  },
                });
              }

              //////////////////////////////////////////////////////
              // 2️⃣ Escalation Logic
              //////////////////////////////////////////////////////

              const nextLevel = current.escalationLevel + 1;

              // Level 4 → Admin review
              if (nextLevel >= 4) {

                await tx.application.update({
                  where: { id: app.id },
                  data: {
                    manualReview: true,
                    agentId: null,
                    escalationLevel: 4,
                    status: ApplicationStatus.SUBMITTED,
                    assignmentDeadline: null,
                    assignedAt: null,
                    acceptedAt: null,
                  },
                });

                logger.warn(
                  `🚨 Escalated to ADMIN review → ${app.id}`
                );

                return;
              }

              //////////////////////////////////////////////////////
              // 3️⃣ Reset & Escalate
              //////////////////////////////////////////////////////

              await tx.application.update({
                where: { id: app.id },
                data: {
                  agentId: null,
                  escalationLevel: nextLevel,
                  status: ApplicationStatus.SUBMITTED,
                  assignmentDeadline: null,
                  assignedAt: null,
                  acceptedAt: null,
                },
              });

              shouldReassign = true;
            });

            if (shouldReassign) {
              await AssignmentEngine.autoAssign(app.id);
              logger.info(`♻ Reassigned application ${app.id}`);
            }

          } catch (singleError) {
            logger.error(
              `Timeout handling failed for ${app.id}`,
              singleError
            );
          }

        }

      } catch (error) {
        logger.error('Assignment Scheduler Critical Error', error);
      } finally {
        await redis.del('assignment_scheduler_lock');
      }

    });

  }
}