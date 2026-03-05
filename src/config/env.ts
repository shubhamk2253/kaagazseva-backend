import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

/**
 * KAAGAZSEVA - Environment Validation Layer
 * Enterprise-grade config validation
 * Fail fast. Never allow invalid configuration.
 */

const booleanTransformer = z
  .string()
  .optional()
  .transform((val) => val === 'true');

const envSchema = z.object({
  /* =====================================================
     SERVER
  ===================================================== */
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),

  PORT: z
    .string()
    .default('5000')
    .transform((val) => {
      const port = Number(val);
      if (isNaN(port) || port <= 0) {
        throw new Error('PORT must be a valid number');
      }
      return port;
    }),

  /* =====================================================
     DATABASE
  ===================================================== */
  DATABASE_URL: z
    .string()
    .min(1, 'DATABASE_URL is required')
    .refine(
      (val) =>
        val.startsWith('postgres://') ||
        val.startsWith('postgresql://'),
      'DATABASE_URL must be a valid PostgreSQL connection string'
    ),

  /* =====================================================
     REDIS
  ===================================================== */
  REDIS_URL: z
    .string()
    .min(1, 'REDIS_URL is required'),

  /* =====================================================
     JWT SECURITY
  ===================================================== */
  JWT_ACCESS_SECRET: z
    .string()
    .min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),

  JWT_REFRESH_SECRET: z
    .string()
    .min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),

  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  SMS_GATEWAY_KEY: z.string().optional(),
  SMS_GATEWAY_URL: z.string().optional(),
  /* =====================================================
     AWS S3
  ===================================================== */
  AWS_ACCESS_KEY_ID: z.string().min(1, 'AWS_ACCESS_KEY_ID is required'),
  AWS_SECRET_ACCESS_KEY: z.string().min(1, 'AWS_SECRET_ACCESS_KEY is required'),
  AWS_REGION: z.string().min(1, 'AWS_REGION is required'),
  AWS_S3_BUCKET_NAME: z.string().min(1, 'AWS_S3_BUCKET_NAME is required'),

  /* =====================================================
     PAYMENTS (Optional in Dev)
  ===================================================== */
  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional(),
  /* =====================================================
     FEATURE TOGGLES
  ===================================================== */
  ENABLE_REDIS_CACHE: booleanTransformer,
  ENABLE_QUEUE: booleanTransformer,
});

/* =====================================================
   VALIDATE ENV
===================================================== */

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('\n❌ Invalid environment variables detected:\n');
  console.error(parsed.error.flatten().fieldErrors);
  console.error('\n🛑 Server stopped due to invalid configuration.\n');
  process.exit(1);
}

/* =====================================================
   EXPORT SAFE ENV
===================================================== */

export const env = parsed.data;

export const isProduction = env.NODE_ENV === 'production';
export const isDevelopment = env.NODE_ENV === 'development';
export const isTest = env.NODE_ENV === 'test';