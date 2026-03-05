import { prisma } from '../../config/database';
import { SuspensionStatus } from '@prisma/client';

export class FounderVisibilityService {

  //////////////////////////////////////////////////////
  // DASHBOARD OVERVIEW
  //////////////////////////////////////////////////////

  static async getOverview() {

    const [
      activeCases,
      confirmedCases,
      autoEscalations,
      frozenWalletStats,
      casesByLevel,
      systemControl
    ] = await Promise.all([

      prisma.suspensionCase.count({
        where: {
          status: {
            in: [
              SuspensionStatus.UNDER_REVIEW,
              SuspensionStatus.ESCALATED,
              SuspensionStatus.AUTO_ESCALATED,
            ],
          },
        },
      }),

      prisma.suspensionCase.count({
        where: {
          status: SuspensionStatus.CONFIRMED,
        },
      }),

      prisma.suspensionCase.count({
        where: {
          status: SuspensionStatus.AUTO_ESCALATED,
        },
      }),

      prisma.wallet.aggregate({
        where: { isFrozen: true },
        _sum: { balance: true },
        _count: true,
      }),

      prisma.suspensionCase.groupBy({
        by: ['level'],
        _count: true,
      }),

      prisma.systemControl.upsert({
        where: { id: 'SYSTEM_CONTROL_SINGLETON' },
        update: {},
        create: { id: 'SYSTEM_CONTROL_SINGLETON' },
      }),

    ]);

    return {

      activeCases,
      confirmedCases,
      autoEscalations,

      frozenWalletCount: frozenWalletStats._count,
      totalFrozenBalance: Number(frozenWalletStats._sum.balance ?? 0),

      casesByLevel,

      systemStatus: {
        paymentsFrozen: systemControl.paymentsFrozen,
        refundsFrozen: systemControl.refundsFrozen,
        withdrawalsFrozen: systemControl.withdrawalsFrozen,
      },

    };

  }

}