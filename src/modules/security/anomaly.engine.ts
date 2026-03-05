import { prisma } from '../../config/database';
import logger from '../../core/logger';
import { TransactionStatus, TransactionType } from '@prisma/client';

/**
 * KAAGAZSEVA - Financial Anomaly Detection Engine
 */

const RAPID_PAYMENT_LIMIT = 5;
const RAPID_PAYMENT_WINDOW_MS = 5 * 60 * 1000;

const HIGH_PAYMENT_THRESHOLD = 20000;

const REFUND_ABUSE_LIMIT = 3;
const REFUND_WINDOW_MS = 24 * 60 * 60 * 1000;

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
          status: TransactionStatus.SUCCESS,
          createdAt: {
            gte: new Date(Date.now() - RAPID_PAYMENT_WINDOW_MS),
          },
        },
      });

      if (recentPayments >= RAPID_PAYMENT_LIMIT) {

        logger.warn({
          event: 'ANOMALY_RAPID_PAYMENTS',
          userId,
          count: recentPayments,
        });

        await prisma.auditLog.create({
          data: {
            userId,
            action: 'CREATE',
            resourceType: 'ANOMALY_PAYMENT_SPIKE',
            newData: { paymentCount: recentPayments },
            success: true,
          },
        });

      }

      //////////////////////////////////////////////////////
      // 2️⃣ High-value payment anomaly
      //////////////////////////////////////////////////////

      if (amount >= HIGH_PAYMENT_THRESHOLD) {

        logger.warn({
          event: 'ANOMALY_HIGH_PAYMENT',
          userId,
          amount,
        });

        await prisma.auditLog.create({
          data: {
            userId,
            action: 'CREATE',
            resourceType: 'ANOMALY_HIGH_PAYMENT',
            newData: { amount },
            success: true,
          },
        });

      }

    } catch (error) {

      logger.error({
        event: 'ANOMALY_PAYMENT_ANALYSIS_FAILED',
        userId,
        error,
      });

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
          type: TransactionType.REFUND,
          createdAt: {
            gte: new Date(Date.now() - REFUND_WINDOW_MS),
          },
        },
      });

      if (recentRefunds >= REFUND_ABUSE_LIMIT) {

        logger.warn({
          event: 'ANOMALY_REFUND_ABUSE',
          userId,
          count: recentRefunds,
        });

        await prisma.auditLog.create({
          data: {
            userId,
            action: 'CREATE',
            resourceType: 'ANOMALY_REFUND_ABUSE',
            newData: { refundCount: recentRefunds },
            success: true,
          },
        });

      }

    } catch (error) {

      logger.error({
        event: 'ANOMALY_REFUND_ANALYSIS_FAILED',
        userId,
        error,
      });

    }

  }

}