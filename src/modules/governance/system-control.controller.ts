import { Response, NextFunction } from 'express';
import { RequestWithUser } from '../../core/types';
import { SystemControlService } from './system-control.service';
import { ApiResponse } from '../../core/ApiResponse';
import { AppError } from '../../core/AppError';

/**
 * KAAGAZSEVA - System Control Controller
 * Founder Emergency Financial Controls
 */

export class SystemControlController {

  //////////////////////////////////////////////////////
  // GET SYSTEM STATUS
  //////////////////////////////////////////////////////

  static async getStatus(
    _req: RequestWithUser,
    res: Response,
    next: NextFunction
  ) {
    try {

      const data = await SystemControlService.getStatus();

      return ApiResponse.success(
        res,
        'System status retrieved',
        data
      );

    } catch (error) {
      next(error);
    }
  }

  //////////////////////////////////////////////////////
  // FREEZE PAYMENTS
  //////////////////////////////////////////////////////

  static async freezePayments(
    req: RequestWithUser,
    res: Response,
    next: NextFunction
  ) {
    try {

      const userId = req.user?.userId;

      if (!userId) {
        throw new AppError('Unauthorized', 401);
      }

      const data = await SystemControlService.freezePayments(userId);

      return ApiResponse.success(
        res,
        'Payments system frozen',
        data
      );

    } catch (error) {
      next(error);
    }
  }

  //////////////////////////////////////////////////////
  // FREEZE REFUNDS
  //////////////////////////////////////////////////////

  static async freezeRefunds(
    req: RequestWithUser,
    res: Response,
    next: NextFunction
  ) {
    try {

      const userId = req.user?.userId;

      if (!userId) {
        throw new AppError('Unauthorized', 401);
      }

      const data = await SystemControlService.freezeRefunds(userId);

      return ApiResponse.success(
        res,
        'Refund system frozen',
        data
      );

    } catch (error) {
      next(error);
    }
  }

  //////////////////////////////////////////////////////
  // FREEZE WITHDRAWALS
  //////////////////////////////////////////////////////

  static async freezeWithdrawals(
    req: RequestWithUser,
    res: Response,
    next: NextFunction
  ) {
    try {

      const userId = req.user?.userId;

      if (!userId) {
        throw new AppError('Unauthorized', 401);
      }

      const data = await SystemControlService.freezeWithdrawals(userId);

      return ApiResponse.success(
        res,
        'Withdrawals system frozen',
        data
      );

    } catch (error) {
      next(error);
    }
  }

  //////////////////////////////////////////////////////
  // UNFREEZE SYSTEM
  //////////////////////////////////////////////////////

  static async unfreezeSystem(
    req: RequestWithUser,
    res: Response,
    next: NextFunction
  ) {
    try {

      const userId = req.user?.userId;

      if (!userId) {
        throw new AppError('Unauthorized', 401);
      }

      const data = await SystemControlService.unfreezeAll(userId);

      return ApiResponse.success(
        res,
        'Financial systems restored',
        data
      );

    } catch (error) {
      next(error);
    }
  }

}