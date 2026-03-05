import { TicketRepository } from './ticket.repository';
import { AppError } from '../../core/AppError';
import { TicketStatus, UserRole, TicketPriority } from '@prisma/client';

/**
 * KAAGAZSEVA - Ticket Service
 */
export class TicketService {

  //////////////////////////////////////////////////////
  // CREATE TICKET
  //////////////////////////////////////////////////////

  static async createTicket(userId: string, data: any) {
    return TicketRepository.create(userId, data);
  }

  //////////////////////////////////////////////////////
  // ADD RESPONSE
  //////////////////////////////////////////////////////

  static async addMessage(
    ticketId: string,
    senderId: string,
    role: UserRole,
    message: string
  ) {

    if (!message || message.trim().length < 2) {
      throw new AppError('Message cannot be empty', 400);
    }

    const ticket = await TicketRepository.findByIdWithResponses(ticketId);

    if (!ticket) {
      throw new AppError('Ticket not found', 404);
    }

    //////////////////////////////////////////////////////
    // BLOCK CLOSED TICKETS
    //////////////////////////////////////////////////////

    if (ticket.status === TicketStatus.CLOSED) {
      throw new AppError('Ticket already closed', 400);
    }

    //////////////////////////////////////////////////////
    // SECURITY RULES
    //////////////////////////////////////////////////////

    if (
      role === UserRole.CUSTOMER &&
      ticket.createdById !== senderId
    ) {
      throw new AppError('Unauthorized access to this ticket', 403);
    }

    //////////////////////////////////////////////////////
    // STATUS TRANSITIONS
    //////////////////////////////////////////////////////

    if (
      (role === UserRole.STATE_ADMIN ||
        role === UserRole.AGENT ||
        role === UserRole.FOUNDER) &&
      ticket.status === TicketStatus.OPEN
    ) {
      await TicketRepository.updateTicket(ticketId, {
        status: TicketStatus.IN_PROGRESS,
        assignedTo: senderId,
      });
    }

    if (
      role === UserRole.CUSTOMER &&
      ticket.status === TicketStatus.RESOLVED
    ) {
      await TicketRepository.updateTicket(ticketId, {
        status: TicketStatus.IN_PROGRESS,
      });
    }

    return TicketRepository.addResponse(
      ticketId,
      senderId,
      message.trim()
    );
  }

  //////////////////////////////////////////////////////
  // GET TICKET DETAILS
  //////////////////////////////////////////////////////

  static async getTicketDetails(
    ticketId: string,
    userId: string,
    role: UserRole
  ) {

    const ticket = await TicketRepository.findByIdWithResponses(ticketId);

    if (!ticket) {
      throw new AppError('Ticket not found', 404);
    }

    if (
      role === UserRole.CUSTOMER &&
      ticket.createdById !== userId
    ) {
      throw new AppError('Unauthorized access', 403);
    }

    return ticket;
  }

  //////////////////////////////////////////////////////
  // LIST TICKETS
  //////////////////////////////////////////////////////

  static async listTickets(
    userId: string,
    role: UserRole,
    filters: any
  ) {

    const page = Number(filters.page) || 1;
    let limit = Number(filters.limit) || 10;

    limit = Math.min(limit, 50);

    const skip = (page - 1) * limit;

    //////////////////////////////////////////////////////
    // ALLOWED FILTERS
    //////////////////////////////////////////////////////

    const dbFilters: any = {};

    if (filters.status) dbFilters.status = filters.status;
    if (filters.priority) dbFilters.priority = filters.priority;
    if (filters.assignedTo) dbFilters.assignedTo = filters.assignedTo;

    //////////////////////////////////////////////////////
    // CUSTOMER RESTRICTION
    //////////////////////////////////////////////////////

    if (role === UserRole.CUSTOMER) {
      dbFilters.createdById = userId;
    }

    const result = await TicketRepository.listAll(
      dbFilters,
      skip,
      limit
    );

    return {
      ...result,
      currentPage: page,
      totalPages: Math.ceil(result.total / limit),
    };
  }

  //////////////////////////////////////////////////////
  // ADMIN UPDATE
  //////////////////////////////////////////////////////

  static async updateTicket(
    ticketId: string,
    data: {
      status?: TicketStatus;
      priority?: TicketPriority;
      assignedTo?: string;
    }
  ) {
    return TicketRepository.updateTicket(ticketId, data);
  }
}