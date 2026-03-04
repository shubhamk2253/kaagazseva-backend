import { prisma } from '../../config/database';

/**
 * KAAGAZSEVA - Financial Risk Score Engine
 */

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

    //////////////////////////////////////////////////////
    // 1️⃣ High Value Payment
    //////////////////////////////////////////////////////

    if (amount > 10000) {
      riskScore += 20;
    }

    //////////////////////////////////////////////////////
    // 2️⃣ Payment Spike
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

    if (recentPayments >= 3) {
      riskScore += 25;
    }

    //////////////////////////////////////////////////////
    // 3️⃣ Refund History
    //////////////////////////////////////////////////////

    const refunds = await prisma.transaction.count({
      where: {
        userId,
        type: 'REFUND',
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
    // Store Risk Score
    //////////////////////////////////////////////////////

    await prisma.application.update({
      where: { id: applicationId },
      data: {
        riskScore,
        manualReview: riskScore >= 60,
      },
    });

    return riskScore;

  }

}