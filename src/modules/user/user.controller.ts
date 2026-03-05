import { Response } from 'express';
import { UserService } from './user.service';
import { asyncHandler } from '../../core/asyncHandler';
import { ApiResponse } from '../../core/ApiResponse';
import { RequestWithUser } from '../../core/types';
import { AppError } from '../../core/AppError';
import logger from '../../core/logger';
import { UserRole } from '@prisma/client';

/**
 * KAAGAZSEVA - User Controller
 * Managing profile identity and administrative oversight.
 */
export class UserController {

  //////////////////////////////////////////////////////
  // GET CURRENT USER PROFILE
  //////////////////////////////////////////////////////

  static getMe = asyncHandler(async (req: RequestWithUser, res: Response) => {

    const userId = req.user!.userId;

    const profile = await UserService.getProfile(userId);

    return ApiResponse.success(
      res,
      'Profile retrieved successfully',
      profile
    );

  });

  //////////////////////////////////////////////////////
  // UPDATE OWN PROFILE
  //////////////////////////////////////////////////////

  static updateMe = asyncHandler(async (req: RequestWithUser, res: Response) => {

    const userId = req.user!.userId;
    const { name } = req.body;

    if (!name || typeof name !== 'string') {
      throw new AppError('Valid name is required', 400);
    }

    const updatedProfile = await UserService.updateProfile(
      userId,
      { name }
    );

    return ApiResponse.success(
      res,
      'Profile updated successfully',
      updatedProfile
    );

  });

  //////////////////////////////////////////////////////
  // ADMIN: GET ALL USERS
  //////////////////////////////////////////////////////

  static adminGetAllUsers = asyncHandler(async (req: RequestWithUser, res: Response) => {

    const roleQuery = req.query.role as string | undefined;

    let role: UserRole | undefined;

    if (roleQuery && Object.values(UserRole).includes(roleQuery as UserRole)) {
      role = roleQuery as UserRole;
    }

    const filters = {
      role,
      search: req.query.search as string | undefined,
      page: req.query.page ? Number(req.query.page) : undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
    };

    const result = await UserService.getAllUsers(filters);

    return ApiResponse.success(
      res,
      'Users fetched successfully',
      result
    );

  });

  //////////////////////////////////////////////////////
  // ADMIN: TOGGLE USER STATUS
  //////////////////////////////////////////////////////

  static adminUpdateStatus = asyncHandler(async (req: RequestWithUser, res: Response) => {

    const adminId = req.user!.userId;
    const { id } = req.params;
    const { isActive } = req.body;

    if (typeof isActive !== 'boolean') {
      throw new AppError('isActive must be boolean', 400);
    }

    const result = await UserService.toggleUserStatus(
      adminId,
      id,
      isActive
    );

    logger.warn({
      event: 'ADMIN_USER_STATUS_UPDATED',
      adminId,
      targetUserId: id,
      isActive,
    });

    return ApiResponse.success(
      res,
      `User account ${isActive ? 'activated' : 'suspended'} successfully`,
      result
    );

  });

}