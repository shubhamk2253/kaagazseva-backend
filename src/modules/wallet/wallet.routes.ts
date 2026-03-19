import { Router } from 'express';
import { WalletController } from './wallet.controller';
import { walletSchema } from './wallet.schema';
import { validate } from '../../middleware/validate.middleware';
import { requireAuth } from '../../middleware/auth.middleware';
import { requireAuthRole } from '../middleware/auth.middleware';
import { apiLimiter } from '../../middleware/rateLimit.middleware';

/**
 * KAAGAZSEVA - Wallet Routes
 * Secure financial operations layer
 */

const router = Router();

///////////////////////////////////////////////////////
// GLOBAL PROTECTION
///////////////////////////////////////////////////////

router.use(requireAuth);

///////////////////////////////////////////////////////
// USER ROUTES
///////////////////////////////////////////////////////

router.get(
  '/balance',
  WalletController.getBalance
);

router.get(
  '/transactions',
  validate(walletSchema.filterTransactions),
  WalletController.getTransactions
);

///////////////////////////////////////////////////////
// AGENT ROUTES
///////////////////////////////////////////////////////

router.post(
  '/withdraw',
  apiLimiter,
  authorizeRoles('AGENT'),
  validate(walletSchema.withdraw),
  WalletController.withdraw
);

///////////////////////////////////////////////////////
// STATE_ADMIN GOVERNANCE
///////////////////////////////////////////////////////

router.post(
  '/withdraw/:id/approve',
  apiLimiter,
  authorizeRoles('STATE_ADMIN'),
  validate(walletSchema.approveWithdrawal),
  WalletController.approveWithdrawal
);

router.post(
  '/withdraw/:id/reject',
  apiLimiter,
  authorizeRoles('STATE_ADMIN'),
  validate(walletSchema.rejectWithdrawal),
  WalletController.rejectWithdrawal
);

export default router;