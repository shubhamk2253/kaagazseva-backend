import { Response } from 'express';
import { TicketService } from './ticket.service';
import { asyncHandler } from '../../core/asyncHandler';
import { ApiResponse } from '../../core/ApiResponse';
import { RequestWithUser } from '../../core/types';
import { AppError } from '../../core/AppError';

/**
 * KAAGAZSEVA - Ticket Controller
 * Enterprise Support Communication Layer
 */
export class TicketController {

  //////////////////////////////////////////////////////
  // CREATE TICKET
  //////////////////////////////////////////////////////
  static create = asyncHandler(async (req: RequestWithUser, res: Response) => {

    const userId = req.user!.userId;

    const ticket = await TicketService.createTicket(
      userId,
      req.body
    );

    return ApiResponse.success(
      res,
      'Support ticket created successfully',
      ticket,
      201
    );
  });

  //////////////////////////////////////////////////////
  // LIST TICKETS
  //////////////////////////////////////////////////////
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

  //////////////////////////////////////////////////////
  // GET TICKET THREAD
  //////////////////////////////////////////////////////
  static getThread = asyncHandler(async (req: RequestWithUser, res: Response) => {

    const { id } = req.params;
    const { userId, role } = req.user!;

    if (!id) {
      throw new AppError('Ticket ID required', 400);
    }

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

  //////////////////////////////////////////////////////
  // ADD MESSAGE
  //////////////////////////////////////////////////////
  static reply = asyncHandler(async (req: RequestWithUser, res: Response) => {

    const { id } = req.params;
    const { userId, role } = req.user!;
    const { message } = req.body;

    if (!id) {
      throw new AppError('Ticket ID required', 400);
    }

    if (!message || message.trim().length < 2) {
      throw new AppError('Message cannot be empty', 400);
    }

    const response = await TicketService.addMessage(
      id,
      userId,
      role,
      message.trim()
    );

    return ApiResponse.success(
      res,
      'Message sent successfully',
      response,
      201
    );
  });

}