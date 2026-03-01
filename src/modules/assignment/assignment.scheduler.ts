import cron from 'node-cron';
import { prisma } from '../../config/database';
import { redis } from '../../config/redis';
import { ApplicationStatus } from '@prisma/client';
import { AssignmentEngine } from './assignment.engine';
import { AgentPriorityEngine } from './agent.priority.engine';
import logger from '../../core/logger';

/**
 * KAAGAZSEVA - Assignment Scheduler
 * Enterprise-safe (Redis distributed lock)
 */

export class AssignmentScheduler {

  static start() {

    logger.info('🕒 Assignment Scheduler Started');

    cron.schedule('*/5 * * * *', async () => {

      // 🔒 GLOBAL REDIS LOCK (60 sec safety)
      const lock =await redis.set(
        'assignment_scheduler_lock',
        'locked',
        'EX',
        60,
        'NX'
      );

      if (!lock) {
        return; // another instance already running
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
            agentId: true,
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

              // 1️⃣ Penalize Agent
              if (current.agentId) {
                await tx.agentMetrics.update({
                  where: { agentId: current.agentId },
                  data: {
                    timeoutCount: { increment: 1 },
                    activeCases: { decrement: 1 },
                  },
                });
              }

              // 2️⃣ Reset Application
              await tx.application.update({
                where: { id: app.id },
                data: {
                  agentId: null,
                  status: ApplicationStatus.SUBMITTED,
                  assignmentDeadline: null,
                  assignedAt: null,
                  acceptedAt: null,
                },
              });

            });

            // 3️⃣ Recalculate Agent Priority
            if (app.agentId) {
              await AgentPriorityEngine.recalculate(app.agentId);
            }

            // 4️⃣ Reassign
            await AssignmentEngine.autoAssign(app.id);

            logger.info(`♻ Reassigned application ${app.id}`);

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
        // 🔓 Always release global lock
        await redis.del('assignment_scheduler_lock');
      }

    });

  }
}