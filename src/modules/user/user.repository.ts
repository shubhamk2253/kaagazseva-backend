import { prisma } from '../../config/database';
import { Prisma, UserRole } from '@prisma/client';
import { UserQueryFilters } from './user.types';

/**
 * KAAGAZSEVA - User Repository
 * Handles complex queries and administrative data operations.
 */
export class UserRepository {

  //////////////////////////////////////////////////////
  // FIND USER BY ID
  //////////////////////////////////////////////////////

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

  //////////////////////////////////////////////////////
  // UPDATE USER
  //////////////////////////////////////////////////////

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

  //////////////////////////////////////////////////////
  // ADMIN SEARCH USERS
  //////////////////////////////////////////////////////

  static async findAll(filters: UserQueryFilters) {

    const {
      role,
      isActive,
      search,
      page = 1,
      limit = 10,
    } = filters;

    //////////////////////////////////////////////////////
    // SANITIZE PAGINATION
    //////////////////////////////////////////////////////

    const safePage = Math.max(1, page);
    const safeLimit = Math.min(50, Math.max(1, limit));

    const skip = (safePage - 1) * safeLimit;

    //////////////////////////////////////////////////////
    // BUILD WHERE CLAUSE
    //////////////////////////////////////////////////////

    const where: Prisma.UserWhereInput = {};

    if (role) {
      where.role = role as UserRole;
    }

    if (typeof isActive === 'boolean') {
      where.isActive = isActive;
    }

    if (search?.trim()) {

      const term = search.trim();

      where.OR = [
        {
          name: {
            contains: term,
            mode: 'insensitive',
          },
        },
        {
          phoneNumber: {
            contains: term,
          },
        },
      ];
    }

    //////////////////////////////////////////////////////
    // FETCH DATA + COUNT
    //////////////////////////////////////////////////////

    const [users, total] = await prisma.$transaction([

      prisma.user.findMany({
        where,
        include: {
          wallet: {
            select: { balance: true },
          },
        },
        skip,
        take: safeLimit,
        orderBy: {
          createdAt: 'desc',
        },
      }),

      prisma.user.count({
        where,
      }),

    ]);

    //////////////////////////////////////////////////////
    // RESPONSE
    //////////////////////////////////////////////////////

    return {
      users,
      total,
      totalPages: Math.max(1, Math.ceil(total / safeLimit)),
      currentPage: safePage,
    };

  }

}