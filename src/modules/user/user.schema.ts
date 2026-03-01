import { z } from 'zod';
import { UserRole } from '../../core/constants';

/**
 * KAAGAZSEVA - User Validation Schemas
 * Production-grade input validation.
 */
export const userSchema = {
  /**
   * 1️⃣ Update Profile
   * Citizen/Agent updating their own information
   */
  updateProfile: z.object({
    body: z.object({
      name: z
        .string()
        .trim()
        .min(2, 'Name must be at least 2 characters')
        .max(50, 'Name cannot exceed 50 characters')
        .regex(/^[a-zA-Z\s]+$/, 'Name can only contain letters and spaces')
        .optional(),
    }),
  }),

  /**
   * 2️⃣ Admin: Search & Filter Users
   */
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
        .default('1')
        .transform((val) => parseInt(val))
        .pipe(z.number().min(1)),

      limit: z
        .string()
        .default('10')
        .transform((val) => parseInt(val))
        .pipe(z.number().min(1).max(100)),
    }),
  }),

  /**
   * 3️⃣ Admin: Activate / Suspend User
   */
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