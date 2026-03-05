import { prisma } from '../../config/database';
import logger from '../../core/logger';
import {
  TransactionStatus,
  TransactionType,
} from '@prisma/client';

/**
 * KAAGAZSEVA - Financial Risk Score Engine
 */

const HIGH_VALUE_THRESHOLD = 10000;
const PAYMENT_SPIKE_WINDOW = 5 * 60 * 1000;

export class RiskEngine {

  //////////////////////////////////////////////////////
  // CALCULATE RISK SCORE
  //////////////////////////////////////////////////////

  static async calculateRisk(
    userId: string,
    applicationId: string,
    amount: number
  ): Promise<number> {

    let riskScore = 0;

    try {

      //////////////////////////////////////////////////////
      // 1️⃣ High Value Payment
      //////////////////////////////////////////////////////

      if (amount > HIGH_VALUE_THRESHOLD) {
        riskScore += 20;
      }

      //////////////////////////////////////////////////////
      // 2️⃣ Payment Spike
      //////////////////////////////////////////////////////

      const recentPayments = await prisma.transaction.count({
        where: {
          userId,
          status: TransactionStatus.SUCCESS,
          createdAt: {
            gte: new Date(Date.now() - PAYMENT_SPIKE_WINDOW),
          },
        },
      });

      if (recentPayments >= 3) {
        riskScore += 25;
      }

      //////////////////////////////////////////////////////
      // 3️⃣ Refund History
      //////////////////////////////////////////////////////

      const refunds = await prisma.transaction.count({
        where: {
          userId,
          type: TransactionType.REFUND,
        },
      });

      if (refunds >= 2) {
        riskScore += 30;
      }

      //////////////////////////////////////////////////////
      // 4️⃣ Clamp Score
      //////////////////////////////////////////////////////

      if (riskScore > 100) {
        riskScore = 100;
      }

      //////////////////////////////////////////////////////
      // STORE RISK SCORE
      //////////////////////////////////////////////////////

      await prisma.application.update({
        where: { id: applicationId },
        data: {
          riskScore,
          manualReview: riskScore >= 60,
        },
      });

      logger.info({
        event: 'RISK_SCORE_CALCULATED',
        userId,
        applicationId,
        riskScore,
      });

      return riskScore;

    } catch (error) {

      logger.error({
        event: 'RISK_ENGINE_FAILED',
        userId,
        applicationId,
        error,
      });

      // Fail safely
      return riskScore;
    }

  }

}