import { prisma } from '../../config/database';
import logger from '../../core/logger';

/**
 * KAAGAZSEVA - System Control Service
 * Phase 8 – Founder Emergency Control Layer
 *
 * Allows founder to freeze:
 * - payments
 * - refunds
 * - withdrawals
 */

const SYSTEM_CONTROL_ID = 'SYSTEM_CONTROL_SINGLETON';

export class SystemControlService {

  //////////////////////////////////////////////////////
  // GET SYSTEM STATUS
  //////////////////////////////////////////////////////

  static async getStatus() {

    const control = await prisma.systemControl.upsert({
      where: { id: SYSTEM_CONTROL_ID },
      update: {},
      create: {
        id: SYSTEM_CONTROL_ID,
        paymentsFrozen: false,
        refundsFrozen: false,
        withdrawalsFrozen: false,
      },
    });

    return control;
  }

  //////////////////////////////////////////////////////
  // FREEZE PAYMENTS
  //////////////////////////////////////////////////////

  static async freezePayments(founderId?: string) {

    const control = await prisma.$transaction(async (tx) => {

      const updated = await tx.systemControl.upsert({
        where: { id: SYSTEM_CONTROL_ID },
        update: { paymentsFrozen: true },
        create: {
          id: SYSTEM_CONTROL_ID,
          paymentsFrozen: true,
        },
      });

      if (founderId) {
        await tx.auditLog.create({
          data: {
            userId: founderId,
            action: 'UPDATE',
            resourceType: 'SYSTEM_CONTROL',
            resourceId: SYSTEM_CONTROL_ID,
            newData: { paymentsFrozen: true },
            success: true,
          },
        });
      }

      return updated;
    });

    logger.warn({
      event: 'SYSTEM_PAYMENTS_FROZEN',
      actor: founderId ?? 'unknown',
    });

    return control;
  }

  //////////////////////////////////////////////////////
  // FREEZE REFUNDS
  //////////////////////////////////////////////////////

  static async freezeRefunds(founderId?: string) {

    const control = await prisma.$transaction(async (tx) => {

      const updated = await tx.systemControl.upsert({
        where: { id: SYSTEM_CONTROL_ID },
        update: { refundsFrozen: true },
        create: {
          id: SYSTEM_CONTROL_ID,
          refundsFrozen: true,
        },
      });

      if (founderId) {
        await tx.auditLog.create({
          data: {
            userId: founderId,
            action: 'UPDATE',
            resourceType: 'SYSTEM_CONTROL',
            resourceId: SYSTEM_CONTROL_ID,
            newData: { refundsFrozen: true },
            success: true,
          },
        });
      }

      return updated;
    });

    logger.warn({
      event: 'SYSTEM_REFUNDS_FROZEN',
      actor: founderId ?? 'unknown',
    });

    return control;
  }

  //////////////////////////////////////////////////////
  // FREEZE WITHDRAWALS
  //////////////////////////////////////////////////////

  static async freezeWithdrawals(founderId?: string) {

    const control = await prisma.$transaction(async (tx) => {

      const updated = await tx.systemControl.upsert({
        where: { id: SYSTEM_CONTROL_ID },
        update: { withdrawalsFrozen: true },
        create: {
          id: SYSTEM_CONTROL_ID,
          withdrawalsFrozen: true,
        },
      });

      if (founderId) {
        await tx.auditLog.create({
          data: {
            userId: founderId,
            action: 'UPDATE',
            resourceType: 'SYSTEM_CONTROL',
            resourceId: SYSTEM_CONTROL_ID,
            newData: { withdrawalsFrozen: true },
            success: true,
          },
        });
      }

      return updated;
    });

    logger.warn({
      event: 'SYSTEM_WITHDRAWALS_FROZEN',
      actor: founderId ?? 'unknown',
    });

    return control;
  }

  //////////////////////////////////////////////////////
  // UNFREEZE EVERYTHING
  //////////////////////////////////////////////////////

  static async unfreezeAll(founderId?: string) {

    const control = await prisma.$transaction(async (tx) => {

      const updated = await tx.systemControl.upsert({
        where: { id: SYSTEM_CONTROL_ID },
        update: {
          paymentsFrozen: false,
          refundsFrozen: false,
          withdrawalsFrozen: false,
        },
        create: {
          id: SYSTEM_CONTROL_ID,
          paymentsFrozen: false,
          refundsFrozen: false,
          withdrawalsFrozen: false,
        },
      });

      if (founderId) {
        await tx.auditLog.create({
          data: {
            userId: founderId,
            action: 'UPDATE',
            resourceType: 'SYSTEM_CONTROL',
            resourceId: SYSTEM_CONTROL_ID,
            newData: {
              paymentsFrozen: false,
              refundsFrozen: false,
              withdrawalsFrozen: false,
            },
            success: true,
          },
        });
      }

      return updated;
    });

    logger.warn({
      event: 'SYSTEM_FINANCIALS_RESTORED',
      actor: founderId ?? 'unknown',
    });

    return control;
  }

}