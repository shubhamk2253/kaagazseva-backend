import { UserRepository } from './user.repository';
import { AppError } from '../../core/AppError';
import { UserQueryFilters } from './user.types';
import { UserRole } from '@prisma/client';
import logger from '../../core/logger';

/**
 * KAAGAZSEVA - User Service
 * Logic for profile management and administrative user control.
 */
export class UserService {

  //////////////////////////////////////////////////////
  // GET PROFILE
  //////////////////////////////////////////////////////

  static async getProfile(userId: string) {

    const user = await UserRepository.findById(userId);

    if (!user) {
      throw new AppError('User profile not found', 404);
    }

    return this.transformUser(user);

  }

  //////////////////////////////////////////////////////
  // UPDATE PROFILE
  //////////////////////////////////////////////////////

  static async updateProfile(
    userId: string,
    data: { name?: string }
  ) {

    if (!data || Object.keys(data).length === 0) {
      throw new AppError(
        'No fields provided for update',
        400
      );
    }

    const updatedUser = await UserRepository.update(
      userId,
      data
    );

    logger.info({
      event: 'USER_PROFILE_UPDATED',
      userId,
    });

    return this.transformUser(updatedUser);

  }

  //////////////////////////////////////////////////////
  // ADMIN: GET ALL USERS
  //////////////////////////////////////////////////////

  static async getAllUsers(
    filters: UserQueryFilters
  ) {

    return UserRepository.findAll(filters);

  }

  //////////////////////////////////////////////////////
  // ADMIN: TOGGLE USER STATUS
  //////////////////////////////////////////////////////

  static async toggleUserStatus(
    adminId: string,
    userId: string,
    isActive: boolean
  ) {

    const user = await UserRepository.findById(userId);

    if (!user) {
      throw new AppError('User not found', 404);
    }

    //////////////////////////////////////////////////////
    // Prevent admin-level suspension
    //////////////////////////////////////////////////////

    if (
      user.role === UserRole.STATE_ADMIN ||
      user.role === UserRole.FOUNDER
    ) {
      throw new AppError(
        'Cannot suspend an admin-level account',
        403
      );
    }

    //////////////////////////////////////////////////////
    // Prevent self-modification
    //////////////////////////////////////////////////////

    if (adminId === userId) {
      throw new AppError(
        'You cannot modify your own account status',
        400
      );
    }

    //////////////////////////////////////////////////////
    // Prevent redundant update
    //////////////////////////////////////////////////////

    if (user.isActive === isActive) {
      return {
        id: user.id,
        isActive: user.isActive,
      };
    }

    const updatedUser = await UserRepository.update(
      userId,
      { isActive }
    );

    logger.warn({
      event: 'USER_STATUS_CHANGED',
      adminId,
      targetUserId: userId,
      newStatus: isActive ? 'ACTIVE' : 'SUSPENDED',
    });

    return {
      id: updatedUser.id,
      isActive: updatedUser.isActive,
    };

  }

  //////////////////////////////////////////////////////
  // RESPONSE TRANSFORMER
  //////////////////////////////////////////////////////

  private static transformUser(user: any) {

    return {
      id: user.id,
      phoneNumber: user.phoneNumber,
      name: user.name,
      role: user.role,
      isActive: user.isActive,
      walletBalance: user.wallet
        ? Number(user.wallet.balance)
        : 0,
      createdAt: user.createdAt,
    };

  }

}