import { z } from 'zod';
import { UserRole } from '@prisma/client';

/**
 * KAAGAZSEVA - User Validation Schemas
 * Production-grade input validation.
 */

export const userSchema = {

  //////////////////////////////////////////////////////
  // 1️⃣ UPDATE PROFILE
  //////////////////////////////////////////////////////

  updateProfile: z.object({
    body: z.object({
      name: z
        .string()
        .trim()
        .min(2, 'Name must be at least 2 characters')
        .max(50, 'Name cannot exceed 50 characters')
        .regex(/^[A-Za-z\s]+$/, 'Name can only contain letters and spaces')
        .optional(),
    }),
  }),

  //////////////////////////////////////////////////////
  // 2️⃣ ADMIN: SEARCH USERS
  //////////////////////////////////////////////////////

  searchUsers: z.object({
    query: z.object({

      role: z.nativeEnum(UserRole).optional(),

      isActive: z
        .enum(['true', 'false'])
        .transform((val) => val === 'true')
        .optional(),

      search: z
        .string()
        .trim()
        .min(1)
        .max(100)
        .optional(),

      page: z
        .string()
        .regex(/^\d+$/, 'Page must be a number')
        .transform((val) => Number(val))
        .refine((val) => val >= 1, {
          message: 'Page must be at least 1',
        })
        .default('1'),

      limit: z
        .string()
        .regex(/^\d+$/, 'Limit must be a number')
        .transform((val) => Number(val))
        .refine((val) => val >= 1 && val <= 50, {
          message: 'Limit must be between 1 and 50',
        })
        .default('10'),

    }),
  }),

  //////////////////////////////////////////////////////
  // 3️⃣ ADMIN: UPDATE USER STATUS
  //////////////////////////////////////////////////////

  updateStatus: z.object({
    params: z.object({
      id: z.string().uuid('Invalid User ID format'),
    }),

    body: z.object({
      isActive: z.boolean({
        required_error: 'isActive status is required',
      }),
    }),
  }),

};