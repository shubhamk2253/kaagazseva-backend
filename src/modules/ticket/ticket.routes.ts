import { Router } from 'express';
import { TicketController } from './ticket.controller';
import { ticketSchema } from './ticket.schema';
import { validate } from '../../middleware/validate.middleware';
import { requireAuth } from '../../middleware/auth.middleware';
import { apiLimiter } from '../../middleware/rateLimit.middleware';

/**
 * KAAGAZSEVA - Ticket Routes
 * Finalizing the support communication channel.
 */
const router = Router();

/* =====================================================
   GLOBAL PROTECTION
   All ticket routes require authentication
===================================================== */
router.use(requireAuth);

/* =====================================================
   CREATE TICKET
   POST /api/v1/tickets
===================================================== */
router.post(
  '/',
  apiLimiter, // Prevent Ticket Bombing
  validate(ticketSchema.create),
  TicketController.create
);

/* =====================================================
   LIST TICKETS
   GET /api/v1/tickets
   (Citizens see theirs, Admin/Agent see filtered list)
===================================================== */
router.get(
  '/',
  TicketController.list
);

/* =====================================================
   GET TICKET THREAD
   GET /api/v1/tickets/:id
===================================================== */
router.get(
  '/:id',
  validate(ticketSchema.addMessage.pick({ params: true })), 
  // Reusing param validation (UUID check)
  TicketController.getThread
);

/* =====================================================
   ADD MESSAGE TO TICKET
   POST /api/v1/tickets/:id/messages
===================================================== */
router.post(
  '/:id/messages',
  apiLimiter, // Prevent reply spam
  validate(ticketSchema.addMessage),
  TicketController.reply
);

export default router;