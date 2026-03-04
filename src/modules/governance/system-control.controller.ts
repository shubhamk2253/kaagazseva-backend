import { Response, NextFunction } from 'express';
import { RequestWithUser } from '../../core/types';
import { SystemControlService } from './system-control.service';

/**
 * KAAGAZSEVA - System Control Controller
 * Founder Emergency Financial Controls
 */

export class SystemControlController {

  //////////////////////////////////////////////////////
  // GET SYSTEM STATUS
  //////////////////////////////////////////////////////

  static async getStatus(
    req: RequestWithUser,
    res: Response,
    next: NextFunction
  ) {
    try {

      const data = await SystemControlService.getStatus();

      res.status(200).json({
        success: true,
        message: 'System status retrieved',
        data,
      });

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

      const data = await SystemControlService.freezePayments();

      res.status(200).json({
        success: true,
        message: 'Payments system frozen',
        data,
      });

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

      const data = await SystemControlService.freezeRefunds();

      res.status(200).json({
        success: true,
        message: 'Refund system frozen',
        data,
      });

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

      const data = await SystemControlService.freezeWithdrawals();

      res.status(200).json({
        success: true,
        message: 'Withdrawals system frozen',
        data,
      });

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

      const data = await SystemControlService.unfreezeAll();

      res.status(200).json({
        success: true,
        message: 'Financial systems restored',
        data,
      });

    } catch (error) {
      next(error);
    }
  }

}