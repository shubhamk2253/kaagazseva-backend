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
import { ApiResponse } from '../core/ApiResponse';

/**
 * KAAGAZSEVA - Master Router (API v1)
 * Central registry for all application modules.
 */

const router = Router();

///////////////////////////////////////////////////////
// PUBLIC SERVICE ROUTES (NO AUTH)
///////////////////////////////////////////////////////

router.use('/public', publicRoutes);

///////////////////////////////////////////////////////
// PUBLIC AUTH ROUTES
///////////////////////////////////////////////////////

router.use('/auth', authRoutes);

///////////////////////////////////////////////////////
// OTP ROUTES
///////////////////////////////////////////////////////

router.use('/otp', otpRoutes);

///////////////////////////////////////////////////////
// CORE USER MODULES
///////////////////////////////////////////////////////

router.use('/users', userRoutes);
router.use('/applications', applicationRoutes);
router.use('/wallet', walletRoutes);

///////////////////////////////////////////////////////
// SUPPORT & COMMUNICATION
///////////////////////////////////////////////////////

router.use('/tickets', ticketRoutes);
router.use('/notifications', notificationRoutes);

///////////////////////////////////////////////////////
// ADMIN PANEL
///////////////////////////////////////////////////////

router.use('/admin', adminRoutes);

///////////////////////////////////////////////////////
// SYSTEM HEALTH CHECK
///////////////////////////////////////////////////////

router.get('/health', (req, res) => {
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