import { Router } from 'express';
import { WalletController } from './wallet.controller';
import { walletSchema } from './wallet.schema'; // ✅ FIXED (named import)
import { validate } from '../../middleware/validate.middleware';
import { requireAuth } from '../../middleware/auth.middleware';
import { authorizeRoles } from '../../middleware/role.middleware';
import { apiLimiter } from '../../middleware/rateLimit.middleware';

/**
 * KAAGAZSEVA - Wallet Routes
 * Secure financial operations layer
 */
const router = Router();

/* =====================================================
   🔐 GLOBAL PROTECTION
===================================================== */

// All wallet routes require authentication
router.use(requireAuth);

/* =====================================================
   👤 CITIZEN + AGENT ROUTES
===================================================== */

/**
 * GET /api/v1/wallet/balance
 */
router.get(
  '/balance',
  WalletController.getBalance
);

/**
 * GET /api/v1/wallet/transactions
 */
router.get(
  '/transactions',
  validate(walletSchema.filterTransactions),
  WalletController.getTransactions
);

/**
 * POST /api/v1/wallet/topup
 */
router.post(
  '/topup',
  apiLimiter,
  validate(walletSchema.topUp),
  WalletController.topUp
);

/**
 * POST /api/v1/wallet/pay
 */
router.post(
  '/pay',
  apiLimiter,
  validate(walletSchema.processPayment),
  WalletController.payForService
);

/* =====================================================
   🧑‍💼 AGENT ONLY ROUTES
===================================================== */

/**
 * POST /api/v1/wallet/withdraw
 */
router.post(
  '/withdraw',
  apiLimiter,
  authorizeRoles('AGENT'),
  validate(walletSchema.withdraw),
  WalletController.withdraw
);

export default router;