import { Response } from 'express';
import { WalletService } from './wallet.service';
import { asyncHandler } from '../../core/asyncHandler';
import { ApiResponse } from '../../core/ApiResponse';
import { RequestWithUser } from '../../core/types';
import { AppError } from '../../core/AppError';
import { UserRole } from '@prisma/client';

/**
 * KAAGAZSEVA - Wallet Controller
 * Handles HTTP layer for wallet operations.
 */
export class WalletController {

  /* =====================================================
     GET Balance
  ===================================================== */
  static getBalance = asyncHandler(
    async (req: RequestWithUser, res: Response) => {
      const userId = req.user!.userId;

      const balanceData = await WalletService.getBalance(userId);

      return ApiResponse.success(
        res,
        'Balance retrieved successfully',
        balanceData
      );
    }
  );

  /* =====================================================
     GET Transaction History
  ===================================================== */
  static getTransactions = asyncHandler(
    async (req: RequestWithUser, res: Response) => {
      const userId = req.user!.userId;

      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 10;

      const history = await WalletService.getHistory(userId, page, limit);

      return ApiResponse.success(
        res,
        'Transaction history retrieved successfully',
        history
      );
    }
  );

  /* =====================================================
     POST Top-Up
  ===================================================== */
  static topUp = asyncHandler(
    async (req: RequestWithUser, res: Response) => {
      const userId = req.user!.userId;

      const { amountInPaise, paymentMethod, externalReference } = req.body;

      const result = await WalletService.topUp(
        userId,
        amountInPaise,
        paymentMethod,
        externalReference
      );

      return ApiResponse.success(
        res,
        'Wallet recharged successfully',
        result,
        201
      );
    }
  );

  /* =====================================================
     POST Pay For Service
  ===================================================== */
  static payForService = asyncHandler(
    async (req: RequestWithUser, res: Response) => {
      const userId = req.user!.userId;

      const { amountInPaise, serviceType, applicationId } = req.body;

      const result = await WalletService.payForService(
        userId,
        amountInPaise,
        serviceType,
        applicationId
      );

      return ApiResponse.success(
        res,
        'Service payment successful',
        result
      );
    }
  );

  /* =====================================================
     POST Withdrawal Request (Agent)
  ===================================================== */
  static withdraw = asyncHandler(
    async (req: RequestWithUser, res: Response) => {
      const userId = req.user!.userId;
      const { amountInPaise } = req.body;

      const result = await WalletService.withdraw(
        userId,
        amountInPaise
      );

      return ApiResponse.success(
        res,
        'Withdrawal request submitted successfully',
        result
      );
    }
  );

  /* =====================================================
     ADMIN - Approve Withdrawal
     POST /api/v1/wallet/withdraw/:id/approve
  ===================================================== */
  static approveWithdrawal = asyncHandler(
    async (req: RequestWithUser, res: Response) => {

      if (req.user!.role !== UserRole.ADMIN) {
        throw new AppError('Unauthorized action', 403);
      }

      const { id } = req.params;
      const adminId = req.user!.userId;

      const result = await WalletService.approveWithdrawal(
        id,
        adminId
      );

      return ApiResponse.success(
        res,
        'Withdrawal approved successfully',
        result
      );
    }
  );

  /* =====================================================
     ADMIN - Reject Withdrawal
     POST /api/v1/wallet/withdraw/:id/reject
  ===================================================== */
  static rejectWithdrawal = asyncHandler(
    async (req: RequestWithUser, res: Response) => {

      if (req.user!.role !== UserRole.ADMIN) {
        throw new AppError('Unauthorized action', 403);
      }

      const { id } = req.params;
      const { reason } = req.body;
      const adminId = req.user!.userId;

      const result = await WalletService.rejectWithdrawal(
        id,
        reason,
        adminId
      );

      return ApiResponse.success(
        res,
        'Withdrawal rejected successfully',
        result
      );
    }
  );
}