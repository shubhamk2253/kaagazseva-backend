import { z } from 'zod';

/**
 * KAAGAZSEVA - Auth Validation Schemas
 * Email + Password authentication
 */

/* =====================================================
   PASSWORD RULES
   Enforced consistently across register + change
===================================================== */

const passwordSchema = z
  .string()
  .min(8,   'Password must be at least 8 characters')
  .max(100, 'Password too long')
  .regex(/[A-Z]/,        'Password must contain at least one uppercase letter')
  .regex(/[0-9]/,        'Password must contain at least one number')
  .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character');

/* =====================================================
   SCHEMAS
===================================================== */

export const authSchema = {

  /* =====================================================
     REGISTER
     POST /api/v1/auth/register
  ===================================================== */

  register: z.object({
    body: z.object({

      name: z
        .string()
        .trim()
        .min(2,  'Name must be at least 2 characters')
        .max(50, 'Name cannot exceed 50 characters'),

      email: z
        .string()
        .trim()
        .email('Invalid email address')
        .toLowerCase(),

      password: passwordSchema,

      phoneNumber: z
        .string()
        .trim()
        .regex(/^[6-9]\d{9}$/, 'Invalid Indian mobile number')
        .optional(),

    }).strict(),
  }),

  /* =====================================================
     LOGIN
     POST /api/v1/auth/login
  ===================================================== */

  login: z.object({
    body: z.object({

      email: z
        .string()
        .trim()
        .email('Invalid email address')
        .toLowerCase(),

      password: z
        .string()
        .min(1, 'Password is required'),

    }).strict(),
  }),

  /* =====================================================
     REFRESH TOKEN
     POST /api/v1/auth/refresh
     Token from cookie OR body
  ===================================================== */

  refreshToken: z.object({
    body: z.object({
      refreshToken: z
        .string()
        .min(10, 'Invalid refresh token')
        .optional(), // optional because it may come from cookie
    }).strict(),
  }),

  /* =====================================================
     CHANGE PASSWORD
     POST /api/v1/auth/change-password
  ===================================================== */

  changePassword: z.object({
    body: z.object({

      currentPassword: z
        .string()
        .min(1, 'Current password is required'),

      newPassword: passwordSchema,

      confirmPassword: z
        .string()
        .min(1, 'Please confirm your new password'),

    }).strict().refine(
      (data) => data.newPassword === data.confirmPassword,
      {
        message: 'Passwords do not match',
        path:    ['confirmPassword'],
      }
    ).refine(
      (data) => data.currentPassword !== data.newPassword,
      {
        message: 'New password must be different from current password',
        path:    ['newPassword'],
      }
    ),
  }),

  /* =====================================================
     UPDATE PROFILE
     PATCH /api/v1/auth/profile
  ===================================================== */

  updateProfile: z.object({
    body: z.object({

      name: z
        .string()
        .trim()
        .min(2,  'Name must be at least 2 characters')
        .max(50, 'Name too long')
        .optional(),

      phoneNumber: z
        .string()
        .trim()
        .regex(/^[6-9]\d{9}$/, 'Invalid Indian mobile number')
        .optional(),

    }).strict(),
  }),

};