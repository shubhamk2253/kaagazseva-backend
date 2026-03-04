import { UserRepository } from './user.repository';
import { AppError } from '../../core/AppError';
import { UserQueryFilters } from './user.types';
import { UserRole } from '../../core/constants';
import logger from '../../core/logger';

/**
 * KAAGAZSEVA - User Service
 * Logic for profile management and administrative user control.
 */
export class UserService {

  /**
   * Retrieves a user profile and throws 404 if not found
   */
  static async getProfile(userId: string) {
    const user = await UserRepository.findById(userId);

    if (!user) {
      throw new AppError('User profile not found', 404);
    }

    return this.transformUser(user);
  }

  /**
   * Updates a citizen's profile (Self-service)
   */
  static async updateProfile(userId: string, data: { name?: string }) {
    if (!data || Object.keys(data).length === 0) {
      throw new AppError('No fields provided for update', 400);
    }

    const updatedUser = await UserRepository.update(userId, data);

    logger.info(`Profile updated for User: ${userId}`);

    return this.transformUser(updatedUser);
  }

  /**
   * Admin: List and filter users with pagination
   */
  static async getAllUsers(filters: UserQueryFilters) {
    return await UserRepository.findAll(filters);
  }

  /**
   * Admin: Toggle account status (Ban/Unban)
   */
  static async toggleUserStatus(
    adminId: string,
    userId: string,
    isActive: boolean
  ) {
    const user = await UserRepository.findById(userId);

    if (!user) {
      throw new AppError('User not found', 404);
    }

    // Prevent suspending Admin accounts
    if (user.role === UserRole.STATE_ADMIN) {
      throw new AppError('Cannot suspend an Admin account', 403);
    }

    // Prevent admin suspending themselves
    if (adminId === userId) {
      throw new AppError('You cannot modify your own account status', 400);
    }

    const updatedUser = await UserRepository.update(userId, { isActive });

    logger.warn(
      `Admin ${adminId} changed status of User ${userId} to ${
        isActive ? 'ACTIVE' : 'SUSPENDED'
      }`
    );

    return {
      id: updatedUser.id,
      isActive: updatedUser.isActive,
    };
  }

  /**
   * Private transformer to standardize user response
   */
  private static transformUser(user: any) {
    return {
      id: user.id,
      phoneNumber: user.phoneNumber,
      name: user.name,
      role: user.role,
      isActive: user.isActive,
      walletBalance: user.wallet?.balance ?? 0,
      createdAt: user.createdAt,
    };
  }
}