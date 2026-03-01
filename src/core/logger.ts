import winston from 'winston';
import { TransformableInfo } from 'logform';
import { env } from '../config/env';

/**
 * KAAGAZSEVA - Structured Logging System
 * Production-ready logging with JSON support + request tracing.
 */

const isDev = env.NODE_ENV === 'development';

/* =====================================================
   Custom Log Levels
===================================================== */
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'blue',
  http: 'magenta',
  debug: 'white',
};

winston.addColors(colors);

/* =====================================================
   Development Format (Readable)
===================================================== */
const devFormat = winston.format.combine(
  winston.format.colorize({ all: true }),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.printf((info: TransformableInfo) => {
    const { timestamp, level, message, stack, ...meta } = info;

    return `${timestamp} ${level}: ${stack || message} ${
      Object.keys(meta).length ? JSON.stringify(meta) : ''
    }`;
  })
);

/* =====================================================
   Production Format (JSON)
===================================================== */
const prodFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

/* =====================================================
   Transports
===================================================== */
const transports: winston.transport[] = [
  new winston.transports.Console({
    format: isDev ? devFormat : prodFormat,
  }),
];

// Write errors to file only in production
if (!isDev) {
  transports.push(
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      format: prodFormat,
    })
  );
}

/* =====================================================
   Logger Instance
===================================================== */
const logger = winston.createLogger({
  level: isDev ? 'debug' : 'info',
  levels,
  transports,
  exitOnError: false,
});

export default logger;