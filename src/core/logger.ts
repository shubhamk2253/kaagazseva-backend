import winston from 'winston';
import fs from 'fs';
import path from 'path';
import { TransformableInfo } from 'logform';
import DailyRotateFile from 'winston-daily-rotate-file';
import { env } from '../config/env';

/**
 * KAAGAZSEVA - Structured Logging System
 */

const isDev = env.NODE_ENV === 'development';

/* =====================================================
   Ensure Logs Directory Exists
===================================================== */

const logDir = path.resolve('logs');

if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

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
   Development Format
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
   Production Format
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

if (!isDev) {

  transports.push(

    new DailyRotateFile({
      filename: path.join(logDir, 'combined-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '14d',
      format: prodFormat,
    }),

    new DailyRotateFile({
      filename: path.join(logDir, 'error-%DATE%.log'),
      level: 'error',
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '30d',
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

  exceptionHandlers: [

    new winston.transports.File({
      filename: path.join(logDir, 'exceptions.log'),
    }),

  ],

  rejectionHandlers: [

    new winston.transports.File({
      filename: path.join(logDir, 'rejections.log'),
    }),

  ],

});

export default logger;