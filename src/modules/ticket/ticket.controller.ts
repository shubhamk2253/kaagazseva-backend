import { Response } from 'express';
import { TicketService } from './ticket.service';
import { asyncHandler } from '../../core/asyncHandler';
import { ApiResponse } from '../../core/ApiResponse';
import { RequestWithUser } from '../../core/types';

/**
 * KAAGAZSEVA - Ticket Controller
 * Handles grievance intake and threaded communication.
 */
export class TicketController {

  /* =====================================================
     CREATE TICKET
     POST /api/v1/tickets
  ===================================================== */
  static create = asyncHandler(async (req: RequestWithUser, res: Response) => {
    const userId = req.user!.userId;

    const ticket = await TicketService.createTicket(userId, req.body);

    return ApiResponse.success(
      res,
      'Support ticket created successfully',
      ticket,
      201
    );
  });

  /* =====================================================
     LIST TICKETS
     GET /api/v1/tickets
  ===================================================== */
  static list = asyncHandler(async (req: RequestWithUser, res: Response) => {
    const { userId, role } = req.user!;

    const result = await TicketService.listTickets(
      userId,
      role,
      req.query
    );

    return ApiResponse.success(
      res,
      'Tickets retrieved successfully',
      result
    );
  });

  /* =====================================================
     GET THREAD
     GET /api/v1/tickets/:id
  ===================================================== */
  static getThread = asyncHandler(async (req: RequestWithUser, res: Response) => {
    const { id } = req.params;
    const { userId, role } = req.user!;

    const thread = await TicketService.getTicketDetails(
      id,
      userId,
      role
    );

    return ApiResponse.success(
      res,
      'Ticket thread retrieved successfully',
      thread
    );
  });

  /* =====================================================
     ADD MESSAGE
     POST /api/v1/tickets/:id/messages
  ===================================================== */
  static reply = asyncHandler(async (req: RequestWithUser, res: Response) => {
    const { id } = req.params;
    const { userId, role } = req.user!;
    const { message, attachments } = req.body;

    const response = await TicketService.addMessage(
      id,
      userId,
      role,
      message,
      attachments
    );

    return ApiResponse.success(
      res,
      'Message sent successfully',
      response,
      201
    );
  });

}