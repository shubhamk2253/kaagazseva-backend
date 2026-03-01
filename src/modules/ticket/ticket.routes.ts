import { Router } from 'express';
import { TicketController } from './ticket.controller';
import { ticketSchema } from './ticket.schema';
import { validate } from '../../middleware/validate.middleware';
import { requireAuth } from '../../middleware/auth.middleware';
import { apiLimiter } from '../../middleware/rateLimit.middleware';

/**
 * KAAGAZSEVA - Ticket Routes
 * Enterprise Support Communication Layer
 */
const router = Router();

//////////////////////////////////////////////////////
// GLOBAL AUTH PROTECTION
//////////////////////////////////////////////////////
router.use(requireAuth);

//////////////////////////////////////////////////////
// CREATE TICKET
// POST /api/v1/tickets
//////////////////////////////////////////////////////
router.post(
  '/',
  apiLimiter, // Prevent spam / ticket bombing
  validate(ticketSchema.create),
  TicketController.create
);

//////////////////////////////////////////////////////
// LIST TICKETS
// GET /api/v1/tickets
// - Customers → Only their tickets
// - Admin/Agent → Filtered system view
//////////////////////////////////////////////////////
router.get(
  '/',
  TicketController.list
);

//////////////////////////////////////////////////////
// GET SINGLE TICKET THREAD
// GET /api/v1/tickets/:id
//////////////////////////////////////////////////////
router.get(
  '/:id',
  validate(ticketSchema.params), // Clean UUID validation
  TicketController.getThread
);

//////////////////////////////////////////////////////
// ADD MESSAGE TO TICKET
// POST /api/v1/tickets/:id/messages
//////////////////////////////////////////////////////
router.post(
  '/:id/messages',
  apiLimiter, // Prevent reply flooding
  validate(ticketSchema.addMessage),
  TicketController.reply
);

export default router;