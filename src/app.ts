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
import { startAutoEscalationJob } from './jobs/autoEscalation.job';

const app: Application = express();

///////////////////////////////////////////////////////////
// SECURITY MIDDLEWARE
///////////////////////////////////////////////////////////

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      imgSrc:     ["'self'", 'data:', '*.amazonaws.com'],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));

///////////////////////////////////////////////////////////
// CORS
///////////////////////////////////////////////////////////

const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS blocked: ${origin}`));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
}));

///////////////////////////////////////////////////////////
// COMPRESSION
///////////////////////////////////////////////////////////

app.use(compression());

///////////////////////////////////////////////////////////
// GLOBAL RATE LIMITER
///////////////////////////////////////////////////////////

app.use(apiLimiter);

///////////////////////////////////////////////////////////
// RAZORPAY WEBHOOK — raw body BEFORE json parser
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
// REQUEST TRACKING
///////////////////////////////////////////////////////////

app.use(requestIdMiddleware);

///////////////////////////////////////////////////////////
// REQUEST LOGGING
///////////////////////////////////////////////////////////

if (process.env.NODE_ENV === 'production') {
  app.use(morgan('combined', {
    stream: {
      write: (message) => logger.info({
        event: 'HTTP_REQUEST',
        log: message.trim()
      })
    },
    skip: (req) => req.path === '/health'
  }));
} else {
  app.use(morgan('dev'));
}

///////////////////////////////////////////////////////////
// AUDIT MIDDLEWARE — before routes
///////////////////////////////////////////////////////////

app.use(auditMiddleware);

///////////////////////////////////////////////////////////
// HEALTH CHECK
///////////////////////////////////////////////////////////

app.get('/health', async (_req, res) => {
  const checks = {
    server: 'ok',
    database: 'unknown' as string,
    redis: 'unknown' as string,
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

  const allHealthy = Object.values(checks).every(v => v === 'ok');

  res.status(allHealthy ? 200 : 503).json({
    status: allHealthy ? 'ok' : 'degraded',
    service: 'KaagazSeva Backend',
    version: process.env.npm_package_version,
    environment: process.env.NODE_ENV,
    timestamp: new Date().toISOString(),
    checks,
  });
});

app.get('/', (_req, res) => {
  res.json({
    status: 'success',
    message: 'KaagazSeva Backend is Live 🚀',
  });
});

///////////////////////////////////////////////////////////
// API ROUTES
///////////////////////////////////////////////////////////

app.use('/api/v1', routes);

///////////////////////////////////////////////////////////
// ERROR HANDLER — always last
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
  logger.error({ event: 'SHUTDOWN_INITIATED', signal, error: error?.message });

  server?.close(async () => {
    try {
      await prisma.$disconnect();
      await redis.quit();
      logger.info('Graceful shutdown complete');
      process.exit(error ? 1 : 0);
    } catch {
      process.exit(1);
    }
  });

  setTimeout(() => process.exit(1), 10000);
}

process.on('unhandledRejection', (reason) => {
  logger.error({ event: 'UNHANDLED_REJECTION', reason });
});

process.on('uncaughtException', (error) => {
  gracefulShutdown('uncaughtException', error);
});

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT',  () => gracefulShutdown('SIGINT'));

export default app;
