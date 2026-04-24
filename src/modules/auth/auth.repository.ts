import { prisma }   from '../../config/database';
import { UserRole } from '@prisma/client';

/**
 * KAAGAZSEVA - Auth Repository
 * Email + Password authentication
 */

export class AuthRepository {

  /* =====================================================
     FIND BY EMAIL — primary identifier
  ===================================================== */

  static async findByEmail(email: string) {
    return prisma.user.findUnique({
      where:   { email },
      include: { wallet: true },
    });
  }

  /* =====================================================
     FIND BY ID
  ===================================================== */

  static async findById(id: string) {
    return prisma.user.findUnique({
      where:   { id },
      include: { wallet: true },
    });
  }

  /* =====================================================
     CREATE USER + WALLET — atomic transaction
     Called on registration
  ===================================================== */

  static async createWithWallet(data: {
    name?:        string;
    email:        string;
    password:     string; // pre-hashed with bcrypt
    phoneNumber?: string;
    role?:        UserRole;
  }) {
    return prisma.$transaction(async (tx) => {

      const user = await tx.user.create({
        data: {
          name:        data.name,
          email:       data.email,
          password:    data.password,  // bcrypt hash
          phoneNumber: data.phoneNumber,
          role:        data.role ?? UserRole.CUSTOMER,
          wallet: {
            create: {
              balance: 0,  // Decimal field — number not string
            },
          },
        },
        include: { wallet: true },
      });

      return user;
    });
  }

  /* =====================================================
     UPDATE PASSWORD — called on change password
  ===================================================== */

  static async updatePassword(
    userId:          string,
    hashedPassword:  string
  ) {
    return prisma.user.update({
      where: { id: userId },
      data:  { password: hashedPassword },
    });
  }

  /* =====================================================
     UPDATE PROFILE
  ===================================================== */

  static async updateProfile(
    userId: string,
    data: {
      name?:        string;
      phoneNumber?: string;
    }
  ) {
    return prisma.user.update({
      where: { id: userId },
      data,
    });
  }

  /* =====================================================
     DEACTIVATE USER
  ===================================================== */

  static async deactivateUser(userId: string) {
    return prisma.user.update({
      where: { id: userId },
      data:  { isActive: false },
    });
  }

  /* =====================================================
     CHECK EMAIL EXISTS — for registration validation
  ===================================================== */

  static async emailExists(email: string): Promise<boolean> {
    const count = await prisma.user.count({
      where: { email },
    });
    return count > 0;
  }
}