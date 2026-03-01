import { Response } from 'express';
import { WalletService } from './wallet.service';
import { asyncHandler } from '../../core/asyncHandler';
import { ApiResponse } from '../../core/ApiResponse';
import { RequestWithUser } from '../../core/types';

/**
 * KAAGAZSEVA - Wallet Controller
 * Handles HTTP layer for wallet operations.
 */
export class WalletController {

  /* =====================================================
     GET Balance
     GET /api/v1/wallet/balance
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
     GET /api/v1/wallet/transactions?page=1&limit=10
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
     POST /api/v1/wallet/topup
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
     POST /api/v1/wallet/pay
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
     POST Withdrawal
     POST /api/v1/wallet/withdraw
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
}