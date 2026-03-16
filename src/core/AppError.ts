import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import compression from 'compression';

import routes from './routes';

import { requestIdMiddleware } from './middleware/request-id.middleware';
import { auditMiddleware } from './middleware/audit.middleware';
import { errorMiddleware } from './middleware/error.middleware';
import { apiLimiter } from './middleware/rateLimit.middleware';

import logger from './core/logger';
import { prisma } from './core/database';
import { redis } from './core/redis';
import { env } from './config/env';

import { startAutoEscalationJob } from './jobs/autoEscalation.job';

/**
 * KAAGAZSEVA - Express App Configuration
 * Production-grade marketplace backend
 */

const app: Application = express();

///////////////////////////////////////////////////////////
// TRUST PROXY
// Required for correct IP detection behind load balancer
// (AWS ALB, Nginx, Render, Railway etc.)
///////////////////////////////////////////////////////////

app.set('trust proxy', 1);

///////////////////////////////////////////////////////////
// SECURITY MIDDLEWARE
///////////////////////////////////////////////////////////

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc:  ["'self'"],
        styleSrc:   ["'self'", "'unsafe-inline'"],
        imgSrc:     ["'self'", 'data:', '*.amazonaws.com'],
        connectSrc: ["'self'"],
        fontSrc:    ["'self'"],
        objectSrc:  ["'none'"],
        frameSrc:   ["'none'"],
      },
    },
    hsts: {
      maxAge: 31536000,       // 1 year
      includeSubDomains: true,
      preload: true,
    },
    referrerPolicy: {
      policy: 'strict-origin-when-cross-origin',
    },
    crossOriginEmbedderPolicy: false, // allow S3 document embeds
  })
);

///////////////////////////////////////////////////////////
// CORS
///////////////////////////////////////////////////////////

const allowedOrigins = (env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, Postman, curl)
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        logger.warn({
          event: 'CORS_BLOCKED',
          origin,
        });
        callback(new Error(`CORS policy: origin ${origin} not allowed`));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Request-ID',
      'X-Razorpay-Signature',
    ],
    exposedHeaders: ['X-Request-ID'],
  })
);

///////////////////////////////////////////////////////////
// COMPRESSION
///////////////////////////////////////////////////////////

app.use(
  compression({
    level: 6,
    threshold: 1024, // only compress responses > 1KB
    filter: (req, res) => {
      // Don't compress webhook responses
      if (req.path.includes('/webhook')) return false;
      return compression.filter(req, res);
    },
  })
);

///////////////////////////////////////////////////////////
// GLOBAL RATE LIMITER
///////////////////////////////////////////////////////////

app.use(apiLimiter);

///////////////////////////////////////////////////////////
// RAZORPAY WEBHOOK — raw body MUST come before json parser
///////////////////////////////////////////////////////////

app.use(
  '/api/v1/payments/webhook',
  express.raw({ type: 'application/json' })
);

///////////////////////////////////////////////////////////
// BODY PARSERS
///////////////////////////////////////////////////////////

app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));
app.use(cookieParser());

///////////////////////////////////////////////////////////
// REQUEST TRACKING — assign unique ID to every request
///////////////////////////////////////////////////////////

app.use(requestIdMiddleware);

///////////////////////////////////////////////////////////
// REQUEST LOGGING
///////////////////////////////////////////////////////////

if (env.NODE_ENV === 'production') {
  app.use(
    morgan('combined', {
      stream: {
        write: (message) =>
          logger.info({
            event: 'HTTP_REQUEST',
            log: message.trim(),
          }),
      },
      // Skip health checks to reduce log noise
      skip: (req) => req.path === '/health',
    })
  );
} else {
  app.use(morgan('dev'));
}

///////////////////////////////////////////////////////////
// AUDIT MIDDLEWARE — must be before routes
///////////////////////////////////////////////////////////

app.use(auditMiddleware);

///////////////////////////////////////////////////////////
// HEALTH CHECK
// Checks server + database + redis connectivity
///////////////////////////////////////////////////////////

app.get('/health', async (_req, res) => {
  const checks: Record<string, string> = {
    server:   'ok',
    database: 'unknown',
    redis:    'unknown',
  };

  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = 'ok';
  } catch {
    checks.database = 'error';
  }

  try {
    await redis.ping();
    checks.redis = 'ok';
  } catch {
    checks.redis = 'error';
  }

  const allHealthy = Object.values(checks).every((v) => v === 'ok');

  return res.status(allHealthy ? 200 : 503).json({
    status:      allHealthy ? 'ok' : 'degraded',
    service:     'KaagazSeva Backend',
    version:     process.env.npm_package_version || '1.0.0',
    environment: env.NODE_ENV,
    uptime:      Math.floor(process.uptime()),
    timestamp:   new Date().toISOString(),
    checks,
  });
});

app.get('/', (_req, res) => {
  res.json({
    status:  'success',
    message: 'KaagazSeva Backend is Live 🚀',
  });
});

///////////////////////////////////////////////////////////
// API ROUTES
///////////////////////////////////////////////////////////

app.use('/api/v1', routes);

///////////////////////////////////////////////////////////
// ERROR HANDLER — always last middleware
///////////////////////////////////////////////////////////

app.use(errorMiddleware);

///////////////////////////////////////////////////////////
// START CRON JOBS
///////////////////////////////////////////////////////////

startAutoEscalationJob();

///////////////////////////////////////////////////////////
// GRACEFUL SHUTDOWN
///////////////////////////////////////////////////////////

let server: ReturnType<typeof app.listen>;

export function setServer(s: typeof server) {
  server = s;
}

async function gracefulShutdown(signal: string, error?: Error) {
  logger.error({
    event:  'SHUTDOWN_INITIATED',
    signal,
    error:  error?.message,
  });

  // Stop accepting new connections
  server?.close(async () => {
    try {
      await prisma.$disconnect();
      logger.info('Database disconnected');

      await redis.quit();
      logger.info('Redis disconnected');

      logger.info({
        event: 'SHUTDOWN_COMPLETE',
        signal,
      });

      process.exit(error ? 1 : 0);

    } catch (shutdownError) {
      logger.error({
        event: 'SHUTDOWN_ERROR',
        error: shutdownError,
      });
      process.exit(1);
    }
  });

  // Force exit after 10 seconds if graceful shutdown hangs
  setTimeout(() => {
    logger.error({
      event:  'SHUTDOWN_FORCED',
      reason: 'Timeout after 10 seconds',
    });
    process.exit(1);
  }, 10_000);
}

///////////////////////////////////////////////////////////
// PROCESS SAFETY HANDLERS
///////////////////////////////////////////////////////////

process.on('unhandledRejection', (reason) => {
  logger.error({
    event:  'UNHANDLED_REJECTION',
    reason,
  });
  // Do not exit — log and continue
  // Unhandled rejections are usually non-fatal
});

process.on('uncaughtException', (error) => {
  // These ARE fatal — trigger graceful shutdown
  gracefulShutdown('uncaughtException', error);
});

process.on('SIGTERM', () => {
  // Sent by Docker/Kubernetes/deployment platforms
  gracefulShutdown('SIGTERM');
});

process.on('SIGINT', () => {
  // Sent by Ctrl+C in terminal
  gracefulShutdown('SIGINT');
});

export default app;