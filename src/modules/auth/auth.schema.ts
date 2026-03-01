import { z } from 'zod';

/**
 * KAAGAZSEVA - Auth Validation Schemas
 * Production-ready validation for Indian phone numbers and OTP flows.
 */

// Indian 10-digit mobile number (without +91)
const phoneRegex = /^[6-9]\d{9}$/;

// 1️⃣ Request OTP Schema
const requestOtp = z.object({
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

// 2️⃣ Verify OTP Schema
const verifyOtp = z.object({
  body: z.object({
    phoneNumber: z
      .string({ required_error: 'Phone number is required' })
      .trim()
      .regex(phoneRegex, 'Invalid Indian phone number'),
    otp: z
      .string({ required_error: 'OTP is required' })
      .trim()
      .regex(/^\d{6}$/, 'OTP must be exactly 6 digits'),
  }).strict(),
});

// 3️⃣ Refresh Token Schema
const refreshToken = z.object({
  body: z.object({
    refreshToken: z
      .string({ required_error: 'Refresh token is required' })
      .min(10, 'Invalid refresh token'),
  }).strict(),
});

// 4️⃣ Update Profile Schema (Post-login)
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
  requestOtp,
  verifyOtp,
  refreshToken,
  updateProfile,
};