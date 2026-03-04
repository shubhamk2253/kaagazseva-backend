import { prisma } from '../../config/database';
import logger from '../../core/logger';

/**
 * KAAGAZSEVA - Financial Anomaly Detection Engine
 */

export class AnomalyEngine {

  //////////////////////////////////////////////////////
  // ANALYZE PAYMENT
  //////////////////////////////////////////////////////

  static async analyzePayment(userId: string, amount: number) {

    try {

      //////////////////////////////////////////////////////
      // 1️⃣ Detect rapid payments
      //////////////////////////////////////////////////////

      const recentPayments = await prisma.transaction.count({
        where: {
          userId,
          status: 'SUCCESS',
          createdAt: {
            gte: new Date(Date.now() - 5 * 60 * 1000),
          },
        },
      });

      if (recentPayments >= 5) {

        logger.warn(`⚠ Rapid payment anomaly → user=${userId}`);

        await prisma.auditLog.create({
          data: {
            userId,
            action: 'CREATE',
            resourceType: 'ANOMALY_PAYMENT_SPIKE',
            success: true,
          },
        });

      }

      //////////////////////////////////////////////////////
      // 2️⃣ High-value payment anomaly
      //////////////////////////////////////////////////////

      if (amount > 20000) {

        logger.warn(`⚠ High-value payment anomaly → user=${userId}`);

        await prisma.auditLog.create({
          data: {
            userId,
            action: 'CREATE',
            resourceType: 'ANOMALY_HIGH_PAYMENT',
            success: true,
          },
        });

      }

    } catch (error) {

      logger.error('Anomaly detection failed', error);

    }
  }

  //////////////////////////////////////////////////////
  // ANALYZE REFUND
  //////////////////////////////////////////////////////

  static async analyzeRefund(userId: string) {

    try {

      const recentRefunds = await prisma.transaction.count({
        where: {
          userId,
          type: 'REFUND',
          createdAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
          },
        },
      });

      if (recentRefunds >= 3) {

        logger.warn(`⚠ Refund abuse detected → user=${userId}`);

        await prisma.auditLog.create({
          data: {
            userId,
            action: 'CREATE',
            resourceType: 'ANOMALY_REFUND_ABUSE',
            success: true,
          },
        });

      }

    } catch (error) {

      logger.error('Refund anomaly detection failed', error);

    }
  }

}