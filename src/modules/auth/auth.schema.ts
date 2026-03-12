import { z } from 'zod';

/**
 * KAAGAZSEVA - Auth Validation Schemas
 * Firebase Authentication Version
 */

// Indian 10-digit mobile number (without +91)
const phoneRegex = /^[6-9]\d{9}$/;

//////////////////////////////////////////////////////
// FIREBASE LOGIN
//////////////////////////////////////////////////////

const firebaseLogin = z.object({
  body: z.object({
    phoneNumber: z
      .string({ required_error: 'Phone number is required' })
      .trim()
      .regex(
        phoneRegex,
        'Invalid Indian phone number. Must be 10 digits starting with 6-9'
      ),
  }).strict(),
});

//////////////////////////////////////////////////////
// REFRESH TOKEN
//////////////////////////////////////////////////////

const refreshToken = z.object({
  body: z.object({
    refreshToken: z
      .string({ required_error: 'Refresh token is required' })
      .min(10, 'Invalid refresh token'),
  }).strict(),
});

//////////////////////////////////////////////////////
// UPDATE PROFILE
//////////////////////////////////////////////////////

const updateProfile = z.object({
  body: z.object({
    name: z
      .string()
      .trim()
      .min(2, 'Name must be at least 2 characters')
      .max(50, 'Name cannot exceed 50 characters')
      .optional(),

    email: z
      .string()
      .trim()
      .email('Invalid email address')
      .optional(),
  }).strict(),
});

export const authSchema = {
  firebaseLogin,
  refreshToken,
  updateProfile,
};