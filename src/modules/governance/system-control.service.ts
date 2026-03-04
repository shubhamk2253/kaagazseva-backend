import { prisma } from '../../config/database';
import { AppError } from '../../core/AppError';
import logger from '../../core/logger';

/**
 * KAAGAZSEVA - System Control Service
 * Phase 8 – Founder Emergency Control Layer
 *
 * Allows founder to freeze:
 * payments
 * refunds
 * withdrawals
 */

export class SystemControlService {

  //////////////////////////////////////////////////////
  // GET SYSTEM STATUS
  //////////////////////////////////////////////////////

  static async getStatus() {

    let control = await prisma.systemControl.findFirst();

    if (!control) {
      control = await prisma.systemControl.create({
        data: {},
      });
    }

    return control;
  }

  //////////////////////////////////////////////////////
  // FREEZE PAYMENTS
  //////////////////////////////////////////////////////

  static async freezePayments() {

    const control = await prisma.systemControl.upsert({
      where: { id: 'SYSTEM_CONTROL_SINGLETON' },
      update: {
        paymentsFrozen: true,
      },
      create: {
        id: 'SYSTEM_CONTROL_SINGLETON',
        paymentsFrozen: true,
      },
    });

    logger.warn('🚨 Founder froze PAYMENTS system');

    return control;
  }

  //////////////////////////////////////////////////////
  // FREEZE REFUNDS
  //////////////////////////////////////////////////////

  static async freezeRefunds() {

    const control = await prisma.systemControl.upsert({
      where: { id: 'SYSTEM_CONTROL_SINGLETON' },
      update: {
        refundsFrozen: true,
      },
      create: {
        id: 'SYSTEM_CONTROL_SINGLETON',
        refundsFrozen: true,
      },
    });

    logger.warn('🚨 Founder froze REFUNDS system');

    return control;
  }

  //////////////////////////////////////////////////////
  // FREEZE WITHDRAWALS
  //////////////////////////////////////////////////////

  static async freezeWithdrawals() {

    const control = await prisma.systemControl.upsert({
      where: { id: 'SYSTEM_CONTROL_SINGLETON' },
      update: {
        withdrawalsFrozen: true,
      },
      create: {
        id: 'SYSTEM_CONTROL_SINGLETON',
        withdrawalsFrozen: true,
      },
    });

    logger.warn('🚨 Founder froze WITHDRAWALS system');

    return control;
  }

  //////////////////////////////////////////////////////
  // UNFREEZE EVERYTHING
  //////////////////////////////////////////////////////

  static async unfreezeAll() {

    const control = await prisma.systemControl.upsert({
      where: { id: 'SYSTEM_CONTROL_SINGLETON' },
      update: {
        paymentsFrozen: false,
        refundsFrozen: false,
        withdrawalsFrozen: false,
      },
      create: {
        id: 'SYSTEM_CONTROL_SINGLETON',
        paymentsFrozen: false,
        refundsFrozen: false,
        withdrawalsFrozen: false,
      },
    });

    logger.warn('✅ Founder restored financial systems');

    return control;
  }

}