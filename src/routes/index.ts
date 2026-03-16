import { Router } from 'express';

import authRoutes         from '../modules/auth/auth.routes';
import userRoutes         from '../modules/user/user.routes';
import agentRoutes        from '../modules/agent/agent.routes';
import applicationRoutes  from '../modules/application/application.routes';
import serviceRoutes      from '../modules/service/service.routes';
import walletRoutes       from '../modules/wallet/wallet.routes';
import paymentRoutes      from '../modules/payment/payment.routes';
import refundRoutes       from '../modules/refund/refund.routes';
import ticketRoutes       from '../modules/ticket/ticket.routes';
import notificationRoutes from '../modules/notification/notification.routes';
import adminRoutes        from '../modules/admin/admin.routes';
import publicRoutes       from '../modules/public/public.routes';
import pincodeRoutes      from '../modules/geography/pincode.routes';

// Governance — all under /governance/*
import suspensionRoutes        from '../modules/governance/suspension.routes';
import founderVisibilityRoutes from '../modules/governance/founder-visibility.routes';
import systemControlRoutes     from '../modules/governance/system-control.routes';

import { ApiResponse } from '../core/ApiResponse';

const router = Router();

///////////////////////////////////////////////////////
// PUBLIC — NO AUTH REQUIRED
///////////////////////////////////////////////////////

router.use('/public',   publicRoutes);   // public service catalog
router.use('/pincodes', pincodeRoutes);  // pincode lookup

///////////////////////////////////////////////////////
// AUTH — login, register, OTP, refresh, logout
///////////////////////////////////////////////////////

router.use('/auth', authRoutes);
// OTP moved inside auth:
// POST /auth/otp/send
// POST /auth/otp/verify

///////////////////////////////////////////////////////
// PAYMENTS
///////////////////////////////////////////////////////

router.use('/payments', paymentRoutes);
// POST /payments/create-order
// POST /payments/verify
// GET  /payments/:id/status
// POST /payments/webhook  ← Razorpay webhook

///////////////////////////////////////////////////////
// CORE PLATFORM
///////////////////////////////////////////////////////

router.use('/users',        userRoutes);
router.use('/agents',       agentRoutes);
router.use('/applications', applicationRoutes);
router.use('/services',     serviceRoutes);
router.use('/wallet',       walletRoutes);

///////////////////////////////////////////////////////
// REFUNDS & SUPPORT
///////////////////////////////////////////////////////

router.use('/refunds',       refundRoutes);
router.use('/tickets',       ticketRoutes);
router.use('/notifications', notificationRoutes);

///////////////////////////////////////////////////////
// GOVERNANCE — all under /governance
///////////////////////////////////////////////////////

router.use('/governance/suspensions', suspensionRoutes);
router.use('/governance/visibility',  founderVisibilityRoutes);
router.use('/governance/system',      systemControlRoutes);

///////////////////////////////////////////////////////
// ADMIN PANEL
///////////////////////////////////////////////////////

router.use('/admin', adminRoutes);

///////////////////////////////////////////////////////
// API HEALTH
///////////////////////////////////////////////////////

router.get('/health', (_req, res) => {
  return ApiResponse.success(res, 'API healthy', {
    status: 'healthy',
    environment: process.env.NODE_ENV,
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
  });
});

///////////////////////////////////////////////////////
// 404 FALLBACK
///////////////////////////////////////////////////////

router.use('*', (req, res) => {
  return ApiResponse.notFound(
    res,
    `Route not found: ${req.method} ${req.originalUrl}`
  );
});

export default router;