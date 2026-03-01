import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';

import routes from './routes';
import { requestIdMiddleware } from './middleware/request-id.middleware';
import { auditMiddleware } from './middleware/audit.middleware';
import { errorMiddleware } from './middleware/error.middleware';
import logger from './core/logger';

/**
 * KAAGAZSEVA - Express App Configuration
 * Central HTTP pipeline configuration.
 */

const app: Application = express();

/* =====================================================
   GLOBAL SECURITY MIDDLEWARES
===================================================== */

// 🛡 Security Headers
app.use(helmet());

// 🌍 CORS Configuration
app.use(
  cors({
    origin: process.env.FRONTEND_URL || '*',
    credentials: true,
  })
);

// 🧾 Parse JSON & Cookies
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

/* =====================================================
   LOGGING & REQUEST TRACING
===================================================== */

// 📌 Attach unique request ID
app.use(requestIdMiddleware);

// 📊 HTTP request logger (dev only)
if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
}

/* =====================================================
   API ROUTES
===================================================== */

// Versioned API entry point
app.use('/api/v1', routes);

/* =====================================================
   AUDIT LOGGER (State-Changing Operations)
   Must be placed AFTER routes
===================================================== */
app.use(auditMiddleware);

/* =====================================================
   GLOBAL ERROR HANDLER
   Always last middleware
===================================================== */
app.use(errorMiddleware);

/* =====================================================
   UNCAUGHT REJECTION HANDLER (Extra Safety)
===================================================== */
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled Rejection:', reason);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
});

export default app;
app.get('/', (req, res) => {
  res.json({
    status: 'success',
    message: 'KaagazSeva Backend is Live 🚀',
  });
});