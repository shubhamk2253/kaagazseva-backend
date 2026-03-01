import { prisma } from '../../config/database';
import { Prisma } from '@prisma/client';
import { UserRole } from '../../core/constants';
import { UserQueryFilters } from './user.types';

/**
 * KAAGAZSEVA - User Repository
 * Handles complex queries and administrative data operations.
 */
export class UserRepository {

  /**
   * Fetch a single user profile with wallet balance
   */
  static async findById(id: string) {
    return prisma.user.findUnique({
      where: { id },
      include: {
        wallet: {
          select: { balance: true },
        },
      },
    });
  }

  /**
   * Update user profile data
   */
  static async update(
    id: string,
    data: { name?: string; isActive?: boolean }
  ) {
    return prisma.user.update({
      where: { id },
      data,
      include: {
        wallet: {
          select: { balance: true },
        },
      },
    });
  }

  /**
   * Advanced Admin Search
   * Supports filtering by role, status, and partial matches on name/phone.
   */
  static async findAll(filters: UserQueryFilters) {
    const { role, isActive, search, page = 1, limit = 10 } = filters;

    const skip = (page - 1) * limit;

    // Strongly typed where clause
    const where: Prisma.UserWhereInput = {};

    if (role) {
      where.role = role as UserRole;
    }

    if (typeof isActive === 'boolean') {
      where.isActive = isActive;
    }

    if (search) {
      where.OR = [
        {
          name: {
            contains: search,
            mode: 'insensitive',
          },
        },
        {
          phoneNumber: {
            contains: search,
          },
        },
      ];
    }

    // Transaction ensures count and data are in sync
    const [users, total] = await prisma.$transaction([
      prisma.user.findMany({
        where,
        include: {
          wallet: {
            select: { balance: true },
          },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.user.count({ where }),
    ]);

    return {
      users,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      currentPage: page,
    };
  }
}