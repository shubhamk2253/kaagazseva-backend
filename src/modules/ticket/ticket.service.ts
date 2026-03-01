import { TicketRepository } from './ticket.repository';
import { AppError } from '../../core/AppError';
import { TicketStatus, UserRole, TicketPriority } from '@prisma/client';

/**
 * KAAGAZSEVA - Ticket Service
 * Business logic for grievance lifecycle & threaded communication.
 */
export class TicketService {

  /* =====================================================
     CREATE TICKET (Customer)
  ===================================================== */
  static async createTicket(userId: string, data: any) {
    return TicketRepository.create(userId, data);
  }

  /* =====================================================
     ADD RESPONSE (Threaded Conversation)
  ===================================================== */
  static async addMessage(
    ticketId: string,
    senderId: string,
    role: UserRole,
    message: string,
    attachments?: string[]
  ) {
    const ticket = await TicketRepository.findByIdWithResponses(ticketId);

    if (!ticket) {
      throw new AppError('Ticket not found', 404);
    }

    /* -----------------------------
       SECURITY RULES
    ----------------------------- */

    // Customers can only reply to their own tickets
    if (role === UserRole.CUSTOMER && ticket.userId !== senderId) {
      throw new AppError('Unauthorized access to this ticket', 403);
    }

    /* -----------------------------
       STATUS TRANSITION LOGIC
    ----------------------------- */

    // If staff replies to OPEN ticket → move to IN_PROGRESS
    if (
      (role === UserRole.ADMIN || role === UserRole.AGENT) &&
      ticket.status === TicketStatus.OPEN
    ) {
      await TicketRepository.updateTicket(ticketId, {
        status: TicketStatus.IN_PROGRESS,
        assignedTo: senderId,
      });
    }

    // If customer replies to RESOLVED ticket → reopen
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
      message,
      attachments
    );
  }

  /* =====================================================
     GET TICKET DETAILS
  ===================================================== */
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
    if (role === UserRole.CUSTOMER && ticket.userId !== userId) {
      throw new AppError('Unauthorized access', 403);
    }

    return ticket;
  }

  /* =====================================================
     LIST TICKETS (Role-aware filtering)
  ===================================================== */
  static async listTickets(
    userId: string,
    role: UserRole,
    filters: any
  ) {
    const page = Number(filters.page) || 1;
    const limit = Number(filters.limit) || 10;

    const skip = (page - 1) * limit;

    // Remove pagination from DB filter
    const { page: _p, limit: _l, ...dbFilters } = filters;

    // Customers only see their own tickets
    if (role === UserRole.CUSTOMER) {
      dbFilters.userId = userId;
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

  /* =====================================================
     ADMIN UPDATE STATUS / PRIORITY
  ===================================================== */
  static async updateTicket(
    ticketId: string,
    data: {
      status?: TicketStatus;
      priority?: TicketPriority;
      assignedTo?: string;
    }
  ) {
    const ticket = await TicketRepository.updateTicket(ticketId, data);

    return ticket;
  }
}