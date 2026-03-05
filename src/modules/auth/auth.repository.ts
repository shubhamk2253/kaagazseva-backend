import { prisma } from '../../config/database';
import { UserRole } from '@prisma/client';

/**
 * KAAGAZSEVA - Auth Repository
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
              balance: '0', // safer for Decimal
            },
          },
        },
        include: { wallet: true },
      });

      return user;
    });
  }

  /**
   * Update profile
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
   */
  static async findById(id: string) {
    return prisma.user.findUnique({
      where: { id },
      include: { wallet: true },
    });
  }

  /**
   * Soft disable user
   */
  static async deactivateUser(userId: string) {
    return prisma.user.update({
      where: { id: userId },
      data: { isActive: false },
    });
  }
}