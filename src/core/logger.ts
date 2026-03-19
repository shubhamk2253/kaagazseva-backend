import winston from 'winston';
import fs from 'fs';
import path from 'path';
import { TransformableInfo } from 'logform';
import DailyRotateFile from 'winston-daily-rotate-file';
import { env } from '../config/env';

/**
 * KAAGAZSEVA - Structured Logging System
 * Features:
 * - Dev: colorized human-readable output
 * - Prod: JSON structured output
 * - Log rotation with separate error logs
 * - Sensitive data sanitization
 * - Request-scoped child loggers
 * - Cloud platform aware
 */

const isDev = env.NODE_ENV === 'development';

// Detect ephemeral cloud platforms
const isCloudPlatform = !!(
  process.env.RENDER ||
  process.env.RAILWAY_ENVIRONMENT ||
  process.env.DYNO
);

/* =====================================================
   Log Directory
===================================================== */

const logDir = path.resolve('logs');

if (!isDev && !isCloudPlatform) {
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
}

/* =====================================================
   Custom Levels & Colors
===================================================== */

const levels = {
  error: 0,
  warn:  1,
  info:  2,
  http:  3,
  debug: 4,
};

const colors = {
  error: 'red',
  warn:  'yellow',
  info:  'blue',
  http:  'magenta',
  debug: 'white',
};

winston.addColors(colors);

/* =====================================================
   Sensitive Data Sanitization
===================================================== */

const SENSITIVE_KEYS = [
  'password', 'confirmPassword', 'token',
  'refreshToken', 'accessToken', 'secret',
  'cvv', 'cardNumber', 'aadhaar', 'pan',
  'otp', 'pin', 'authorization', 'cookie',
];

function sanitize(obj: Record<string, any>): Record<string, any> {
  if (!obj || typeof obj !== 'object') return obj;

  return Object.keys(obj).reduce((acc, key) => {
    if (SENSITIVE_KEYS.some(k => key.toLowerCase().includes(k))) {
      acc[key] = '[REDACTED]';
    } else if (typeof obj[key] === 'object' && obj[key] !== null) {
      acc[key] = sanitize(obj[key]);
    } else {
      acc[key] = obj[key];
    }
    return acc;
  }, {} as Record<string, any>);
}

const sanitizeFormat = winston.format((info) => {
  return { ...info, ...sanitize(info as any) };
})();

/* =====================================================
   Formats
===================================================== */

const devFormat = winston.format.combine(
  sanitizeFormat,
  winston.format.colorize({ all: true }),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.printf((info: TransformableInfo) => {
    const { timestamp, level, message, stack, ...meta } = info;
    return `${timestamp} ${level}: ${stack || message} ${
      Object.keys(meta).length ? JSON.stringify(meta, null, 2) : ''
    }`;
  })
);

const prodFormat = winston.format.combine(
  sanitizeFormat,
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

/* =====================================================
   Transports
===================================================== */

const consoleTransport = new winston.transports.Console({
  format: isDev ? devFormat : prodFormat,
});

const transports: winston.transport[] = [consoleTransport];

// File transports only for persistent filesystems
if (!isDev && !isCloudPlatform) {
  transports.push(
    new DailyRotateFile({
      filename:    path.join(logDir, 'combined-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize:     '20m',
      maxFiles:    '14d',
      format:      prodFormat,
    }),
    new DailyRotateFile({
      filename:    path.join(logDir, 'error-%DATE%.log'),
      level:       'error',
      datePattern: 'YYYY-MM-DD',
      maxSize:     '20m',
      maxFiles:    '30d',
      format:      prodFormat,
    })
  );
}

/* =====================================================
   Logger Instance
===================================================== */

const logger = winston.createLogger({
  level:      isDev ? 'debug' : 'info',
  levels,
  transports,
  exitOnError: false,

  exceptionHandlers: [
    consoleTransport,
    ...(!isDev && !isCloudPlatform ? [
      new winston.transports.File({
        filename: path.join(logDir, 'exceptions.log'),
      })
    ] : []),
  ],

  rejectionHandlers: [
    consoleTransport,
    ...(!isDev && !isCloudPlatform ? [
      new winston.transports.File({
        filename: path.join(logDir, 'rejections.log'),
      })
    ] : []),
  ],
});

/* =====================================================
   Request-Scoped Child Logger
===================================================== */

export function createRequestLogger(requestId: string) {
  return logger.child({ requestId });
}

/* =====================================================
   Health Check
===================================================== */

export function isLoggerHealthy(): boolean {
  try {
    logger.info({ event: 'LOGGER_HEALTH_CHECK' });
    return true;
  } catch {
    return false;
  }
}

export default logger;