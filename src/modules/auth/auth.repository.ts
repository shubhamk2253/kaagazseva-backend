import { prisma } from '../../config/database';
import { UserRole, User } from '@prisma/client';

/**
 * KAAGAZSEVA - Auth Repository
 * Responsible for direct database operations for Users and Wallets.
 * Pure database layer. No business logic here.
 */
export class AuthRepository {

  /**
   * Find user by phone number
   */
  static async findByPhone(phoneNumber: string) {
    return prisma.user.findUnique({
      where: { phoneNumber },
      include: { wallet: true },
    });
  }

  /**
   * Create a new user with wallet atomically
   * Guarantees system integrity: No user without wallet.
   */
  static async createWithWallet(
    phoneNumber: string,
    role: UserRole = UserRole.CUSTOMER
  ) {
    return prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          phoneNumber,
          role,
          wallet: {
            create: {
              balance: 0,
            },
          },
        },
        include: { wallet: true },
      });

      return user;
    });
  }

  /**
   * Update basic profile information
   */
  static async updateProfile(
    userId: string,
    data: {
      name?: string;
    }
  ) {
    return prisma.user.update({
      where: { id: userId },
      data,
    });
  }

  /**
   * Find user by ID
   * Used internally for auth verification & admin checks
   */
  static async findById(id: string) {
    return prisma.user.findUnique({
      where: { id },
      include: { wallet: true },
    });
  }

  /**
   * Soft disable user (future-proofing for admin suspension)
   */
  static async deactivateUser(userId: string) {
    return prisma.user.update({
      where: { id: userId },
      data: { isActive: false },
    });
  }
}