import { prisma } from '../../config/database';
import { SuspensionStatus } from '@prisma/client';

export class FounderVisibilityService {

  //////////////////////////////////////////////////////
  // DASHBOARD OVERVIEW
  //////////////////////////////////////////////////////

  static async getOverview() {

    const activeCases = await prisma.suspensionCase.count({
      where: {
        status: {
          in: [
            SuspensionStatus.UNDER_REVIEW,
            SuspensionStatus.ESCALATED,
            SuspensionStatus.AUTO_ESCALATED,
          ],
        },
      },
    });

    const confirmedCases = await prisma.suspensionCase.count({
      where: {
        status: SuspensionStatus.CONFIRMED,
      },
    });

    const autoEscalations = await prisma.suspensionCase.count({
      where: {
        status: SuspensionStatus.AUTO_ESCALATED,
      },
    });

    const frozenWallets = await prisma.wallet.findMany({
      where: { isFrozen: true },
      select: { balance: true },
    });

    const totalFrozenBalance = frozenWallets.reduce(
      (sum, w) => sum + Number(w.balance),
      0
    );

    const casesByLevel = await prisma.suspensionCase.groupBy({
      by: ['level'],
      _count: true,
    });

    return {
      activeCases,
      confirmedCases,
      autoEscalations,
      frozenWalletCount: frozenWallets.length,
      totalFrozenBalance,
      casesByLevel,
    };
  }
}