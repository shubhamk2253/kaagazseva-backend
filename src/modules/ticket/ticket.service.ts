import { TicketRepository } from './ticket.repository';
import { AppError } from '../../core/AppError';
import { TicketStatus, UserRole, TicketPriority } from '@prisma/client';

/**
 * KAAGAZSEVA - Ticket Service (Schema Aligned)
 */
export class TicketService {

  //////////////////////////////////////////////////////
  // CREATE TICKET (Customer)
  //////////////////////////////////////////////////////

  static async createTicket(userId: string, data: any) {
    return TicketRepository.create(userId, data);
  }

  //////////////////////////////////////////////////////
  // ADD RESPONSE (Threaded Conversation)
  //////////////////////////////////////////////////////

  static async addMessage(
    ticketId: string,
    senderId: string,
    role: UserRole,
    message: string
  ) {
    const ticket = await TicketRepository.findByIdWithResponses(ticketId);

    if (!ticket) {
      throw new AppError('Ticket not found', 404);
    }

    //////////////////////////////////////////////////////
    // SECURITY RULES
    //////////////////////////////////////////////////////

    // Customers can only reply to their own tickets
    if (
      role === UserRole.CUSTOMER &&
      ticket.createdById !== senderId
    ) {
      throw new AppError('Unauthorized access to this ticket', 403);
    }

    //////////////////////////////////////////////////////
    // STATUS TRANSITIONS
    //////////////////////////////////////////////////////

    // Staff replies to OPEN → move to IN_PROGRESS
    if (
      (role === UserRole.ADMIN || role === UserRole.AGENT) &&
      ticket.status === TicketStatus.OPEN
    ) {
      await TicketRepository.updateTicket(ticketId, {
        status: TicketStatus.IN_PROGRESS,
        assignedTo: senderId,
      });
    }

    // Customer replies to RESOLVED → reopen
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
      message
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

    // Customers can only view their own tickets
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
    const limit = Number(filters.limit) || 10;

    const skip = (page - 1) * limit;

    const { page: _p, limit: _l, ...dbFilters } = filters;

    // Customers only see their own tickets
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