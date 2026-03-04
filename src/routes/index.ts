import { Router } from 'express';

import authRoutes from '../modules/auth/auth.routes';
import userRoutes from '../modules/user/user.routes';
import applicationRoutes from '../modules/application/application.routes';
import walletRoutes from '../modules/wallet/wallet.routes';
import adminRoutes from '../modules/admin/admin.routes';
import ticketRoutes from '../modules/ticket/ticket.routes';
import notificationRoutes from '../modules/notification/notification.routes';
import otpRoutes from './otp.routes';
import publicRoutes from '../modules/public/public.routes';

import suspensionRoutes from '../modules/governance/suspension.routes';
import founderVisibilityRoutes from '../modules/governance/founder-visibility.routes';
import systemControlRoutes from '../modules/governance/system-control.routes'; // ✅ Phase 8

import refundRoutes from '../modules/refund/refund.routes'; // ✅ Phase 5B
import paymentWebhookRoutes from '../modules/payment/payment.webhook.routes';

import { ApiResponse } from '../core/ApiResponse';

/**
 * KAAGAZSEVA - Master Router (API v1)
 * Central API registry
 */

const router = Router();

///////////////////////////////////////////////////////
// PUBLIC SERVICE ROUTES (NO AUTH)
///////////////////////////////////////////////////////

router.use('/public', publicRoutes);

///////////////////////////////////////////////////////
// AUTH
///////////////////////////////////////////////////////

router.use('/auth', authRoutes);
router.use('/otp', otpRoutes);

///////////////////////////////////////////////////////
// PAYMENTS & WEBHOOKS
///////////////////////////////////////////////////////

router.use('/payments', paymentWebhookRoutes);

///////////////////////////////////////////////////////
// CORE USER MODULES
///////////////////////////////////////////////////////

router.use('/users', userRoutes);
router.use('/applications', applicationRoutes);
router.use('/wallet', walletRoutes);

///////////////////////////////////////////////////////
// REFUND GOVERNANCE (PHASE 5B)
///////////////////////////////////////////////////////

router.use('/refunds', refundRoutes);

///////////////////////////////////////////////////////
// GOVERNANCE & SUSPENSION (PHASE 6)
///////////////////////////////////////////////////////

router.use('/suspensions', suspensionRoutes);

///////////////////////////////////////////////////////
// FOUNDER VISIBILITY
///////////////////////////////////////////////////////

router.use('/governance', founderVisibilityRoutes);

///////////////////////////////////////////////////////
// PHASE 8 - SYSTEM CONTROL (FOUNDER EMERGENCY CONTROLS)
///////////////////////////////////////////////////////

router.use('/governance/system', systemControlRoutes);

///////////////////////////////////////////////////////
// SUPPORT
///////////////////////////////////////////////////////

router.use('/tickets', ticketRoutes);
router.use('/notifications', notificationRoutes);

///////////////////////////////////////////////////////
// STATE_ADMIN PANEL
///////////////////////////////////////////////////////

router.use('/admin', adminRoutes);

///////////////////////////////////////////////////////
// SYSTEM HEALTH
///////////////////////////////////////////////////////

router.get('/health', (_req, res) => {
  return ApiResponse.success(res, 'System healthy', {
    status: 'healthy',
    environment: process.env.NODE_ENV,
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    version: '1.0.0-enterprise',
  });
});

///////////////////////////////////////////////////////
// 404 FALLBACK
///////////////////////////////////////////////////////

router.use('*', (req, res) => {
  return res.status(404).json({
    success: false,
    message: 'API route not found',
    path: req.originalUrl,
  });
});

export default router;