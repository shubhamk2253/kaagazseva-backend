import { prisma } from '../../config/database';
import {
  ApplicationStatus,
} from '@prisma/client';
import { AssignmentEngine } from './assignment.engine';
import { AgentPriorityEngine } from './agent.priority.engine';
import logger from '../../core/logger';

/**
 * KAAGAZSEVA - Assignment Timeout Job
 * Handles 60-minute acceptance rule
 */
export class AssignmentTimeoutJob {

  //////////////////////////////////////////////////////
  // RUN TIMEOUT PROCESSOR
  //////////////////////////////////////////////////////

  static async run() {

    logger.info('⏱ Checking expired assignments...');

    const expiredAssignments = await prisma.application.findMany({
      where: {
        status: ApplicationStatus.ASSIGNED,
        assignmentDeadline: {
          lt: new Date(),
        },
      },
    });

    if (!expiredAssignments.length) {
      logger.info('No expired assignments found.');
      return;
    }

    logger.warn(
      `⚠ Found ${expiredAssignments.length} expired assignments`
    );

    for (const app of expiredAssignments) {

      try {

        await prisma.$transaction(async (tx) => {

          //////////////////////////////////////////////////////
          // 1️⃣ Penalize Agent
          //////////////////////////////////////////////////////

          if (app.agentId) {

            await tx.agentMetrics.update({
              where: { agentId: app.agentId },
              data: {
                timeoutCount: { increment: 1 },
                activeCases: { decrement: 1 },
              },0
            });

            // 🔥 Recalculate priority after timeout
            await AgentPriorityEngine.recalculate(app.agentId);
          }

          //////////////////////////////////////////////////////
          // 2️⃣ Reset Application
          //////////////////////////////////////////////////////

          await tx.application.update({
            where: { id: app.id },
            data: {
              agentId: null,
              status: ApplicationStatus.SUBMITTED,
              assignmentDeadline: null,
              assignedAt: null,
            },
          });

        });

        //////////////////////////////////////////////////////
        // 3️⃣ Trigger Reassignment (Outside TX)
        //////////////////////////////////////////////////////

        await AssignmentEngine.autoAssign(app.id);

        logger.info(`♻ Reassigned application ${app.id}`);

      } catch (error) {

        logger.error(
          `Assignment timeout handling failed for ${app.id}`,
          error
        );

      }
    }
  }
}