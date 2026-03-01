import { Response } from 'express';
import { UserService } from './user.service';
import { asyncHandler } from '../../core/asyncHandler';
import { ApiResponse } from '../../core/ApiResponse';
import { RequestWithUser } from '../../core/types';

/**
 * KAAGAZSEVA - User Controller
 * Managing profile identity and administrative oversight.
 */
export class UserController {

  /**
   * GET /api/v1/users/me
   * Fetch current logged-in user's profile
   */
  static getMe = asyncHandler(async (req: RequestWithUser, res: Response) => {
    const userId = req.user!.userId;

    const profile = await UserService.getProfile(userId);

    return ApiResponse.success(
      res,
      'Profile retrieved successfully',
      profile
    );
  });

  /**
   * PATCH /api/v1/users/me
   * Update own profile
   */
  static updateMe = asyncHandler(async (req: RequestWithUser, res: Response) => {
    const userId = req.user!.userId;

    const updatedProfile = await UserService.updateProfile(userId, {
      name: req.body.name,
    });

    return ApiResponse.success(
      res,
      'Profile updated successfully',
      updatedProfile
    );
  });

  /**
   * GET /api/v1/users/admin/all
   * Admin only: List users with filters
   */
  static adminGetAllUsers = asyncHandler(async (req: RequestWithUser, res: Response) => {
    const filters = req.query as any;

    const result = await UserService.getAllUsers(filters);

    return ApiResponse.success(
      res,
      'Users fetched successfully',
      result
    );
  });

  /**
   * PATCH /api/v1/users/admin/:id/status
   * Admin only: Suspend or activate user
   */
  static adminUpdateStatus = asyncHandler(async (req: RequestWithUser, res: Response) => {
    const adminId = req.user!.userId;
    const { id } = req.params;
    const { isActive } = req.body;

    const result = await UserService.toggleUserStatus(
      adminId,
      id,
      isActive
    );

    return ApiResponse.success(
      res,
      `User account ${isActive ? 'activated' : 'suspended'} successfully`,
      result
    );
  });
}