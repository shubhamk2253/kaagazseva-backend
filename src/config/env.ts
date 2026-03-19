import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

/**
 * KAAGAZSEVA - Environment Validation Layer
 * Enterprise-grade config validation
 * Fail fast. Never allow invalid configuration.
 * Render deployment ready.
 */

/* =====================================================
   TRANSFORMERS
===================================================== */

const booleanTransformer = z
  .string()
  .optional()
  .transform((val) => val === 'true');

const jwtExpiryPattern = /^\d+[smhd]$/;

/* =====================================================
   SCHEMA
===================================================== */

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
        throw new Error('PORT must be a valid positive number');
      }
      return port;
    }),

  /* =====================================================
     DATABASE (SUPABASE)
     PORT 6543 = pgBouncer pooled (use for app)
     PORT 5432 = direct (use for migrations only)
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

  DIRECT_DATABASE_URL: z
    .string()
    .min(1, 'DIRECT_DATABASE_URL is required')
    .refine(
      (val) =>
        val.startsWith('postgres://') ||
        val.startsWith('postgresql://'),
      'DIRECT_DATABASE_URL must be a valid PostgreSQL connection string'
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

  JWT_ACCESS_EXPIRES_IN: z
    .string()
    .default('15m')
    .refine(
      (val) => jwtExpiryPattern.test(val),
      'JWT_ACCESS_EXPIRES_IN must be like: 15m, 1h, 7d'
    ),

  JWT_REFRESH_EXPIRES_IN: z
    .string()
    .default('30d')
    .refine(
      (val) => jwtExpiryPattern.test(val),
      'JWT_REFRESH_EXPIRES_IN must be like: 15m, 1h, 30d'
    ),

  /* =====================================================
     AWS S3
     Optional in dev — required in production
  ===================================================== */
  AWS_ACCESS_KEY_ID:     z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  AWS_REGION:            z.string().default('ap-south-1'),
  AWS_S3_BUCKET_NAME:    z.string().optional(),

  /* =====================================================
     RAZORPAY
     Optional in dev — required in production
  ===================================================== */
  RAZORPAY_KEY_ID:         z.string().optional(),
  RAZORPAY_KEY_SECRET:     z.string().optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional(),

  /* =====================================================
     FIREBASE FCM
  ===================================================== */
  FCM_SERVER_KEY:      z.string().optional(),
  FIREBASE_PROJECT_ID: z.string().optional(),

  /* =====================================================
     SMS (Future — post DLT registration)
  ===================================================== */
  SMS_GATEWAY_KEY: z.string().optional(),
  SMS_GATEWAY_URL: z.string().optional(),

  /* =====================================================
     CORS & URLS
     Frontend:  https://kaagazseva-frontend.onrender.com
     Backend:   https://kaagazseva-backend.onrender.com
     Domain:    https://kaagazseva.in
  ===================================================== */
  ALLOWED_ORIGINS: z
    .string()
    .min(1, 'ALLOWED_ORIGINS is required'),

  FRONTEND_URL: z
    .string()
    .url('FRONTEND_URL must be a valid URL')
    .default('https://kaagazseva-frontend.onrender.com'),

  APP_URL: z
    .string()
    .url('APP_URL must be a valid URL')
    .default('https://kaagazseva-backend.onrender.com'),

  /* =====================================================
     MONITORING & ALERTS
  ===================================================== */
  SLACK_WEBHOOK_URL: z
    .string()
    .url('SLACK_WEBHOOK_URL must be a valid URL')
    .optional(),

  /* =====================================================
     FEATURE FLAGS
  ===================================================== */
  ENABLE_REDIS_CACHE: booleanTransformer,
  ENABLE_QUEUE:       booleanTransformer,

});

/* =====================================================
   VALIDATE — FAIL FAST
===================================================== */

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('\n❌ Invalid environment variables detected:\n');
  parsed.error.flatten().fieldErrors &&
    Object.entries(parsed.error.flatten().fieldErrors).forEach(
      ([key, errors]) => {
        console.error(`  ${key}: ${errors?.join(', ')}`);
      }
    );
  console.error('\n🛑 Server stopped due to invalid configuration.\n');
  process.exit(1);
}

/* =====================================================
   PRODUCTION CHECKS
   Ensure critical vars are set before going live
===================================================== */

if (parsed.data.NODE_ENV === 'production') {

  const productionRequired: Array<keyof typeof parsed.data> = [
    'RAZORPAY_KEY_ID',
    'RAZORPAY_KEY_SECRET',
    'RAZORPAY_WEBHOOK_SECRET',
    'FCM_SERVER_KEY',
    'AWS_ACCESS_KEY_ID',
    'AWS_SECRET_ACCESS_KEY',
    'AWS_S3_BUCKET_NAME',
    'SLACK_WEBHOOK_URL',
  ];

  const missing = productionRequired.filter(
    (key) => !parsed.data[key]
  );

  if (missing.length > 0) {
    console.error('\n❌ Missing required production environment variables:\n');
    missing.forEach((key) => console.error(`  → ${key}`));
    console.error('\n🛑 Server stopped. Set these in Render dashboard.\n');
    process.exit(1);
  }

}

/* =====================================================
   EXPORT TYPED ENV
===================================================== */

export const env = parsed.data;

export const isProduction  = env.NODE_ENV === 'production';
export const isDevelopment = env.NODE_ENV === 'development';
export const isTest        = env.NODE_ENV === 'test';

/* =====================================================
   TYPE EXPORT
   Use this type anywhere you need env shape
===================================================== */

export type Env = typeof env;