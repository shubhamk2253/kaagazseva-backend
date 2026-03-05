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
  apiLimiter,
  validate(ticketSchema.create),
  TicketController.create
);

//////////////////////////////////////////////////////
// LIST TICKETS
//////////////////////////////////////////////////////

router.get(
  '/',
  apiLimiter,
  TicketController.list
);

//////////////////////////////////////////////////////
// GET SINGLE TICKET THREAD
//////////////////////////////////////////////////////

router.get(
  '/:id',
  apiLimiter,
  validate(ticketSchema.params),
  TicketController.getThread
);

//////////////////////////////////////////////////////
// ADD MESSAGE TO TICKET
//////////////////////////////////////////////////////

router.post(
  '/:id/messages',
  apiLimiter,
  validate(ticketSchema.addMessage),
  TicketController.reply
);

export default router;