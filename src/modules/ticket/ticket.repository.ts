import { prisma } from '../../config/database';
import {
  TicketStatus,
  TicketPriority,
  TicketCategory,
  Prisma
} from '@prisma/client';
import { CreateTicketInput } from './ticket.types';

/**
 * KAAGAZSEVA - Ticket Repository
 * Persistence layer for support engine.
 */
export class TicketRepository {

  /* =====================================================
     CREATE TICKET
  ===================================================== */
  static async create(
    userId: string,
    data: CreateTicketInput
  ) {
    return prisma.ticket.create({
      data: {
        userId,
        subject: data.subject,
        description: data.description,
        category: data.category as TicketCategory,
        priority: data.priority || TicketPriority.MEDIUM,
        status: TicketStatus.OPEN,
      },
    });
  }

  /* =====================================================
     GET TICKET WITH FULL THREAD
  ===================================================== */
  static async findByIdWithResponses(id: string) {
    return prisma.ticket.findUnique({
      where: { id },
      include: {
        responses: {
          orderBy: { createdAt: 'asc' },
          include: {
            sender: {
              select: {
                id: true,
                name: true,
                role: true,
              },
            },
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            phoneNumber: true,
            role: true,
          },
        },
        assignedUser: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  /* =====================================================
     ADD MESSAGE TO THREAD
  ===================================================== */
  static async addResponse(
    ticketId: string,
    senderId: string,
    message: string,
    attachments?: string[]
  ) {
    return prisma.$transaction(async (tx) => {

      const response = await tx.ticketResponse.create({
        data: {
          ticketId,
          senderId,
          message,
          attachments: attachments ?? [],
        },
      });

      await tx.ticket.update({
        where: { id: ticketId },
        data: { updatedAt: new Date() },
      });

      return response;
    });
  }

  /* =====================================================
     UPDATE STATUS / ASSIGN
  ===================================================== */
  static async updateTicket(
    ticketId: string,
    data: {
      status?: TicketStatus;
      priority?: TicketPriority;
      assignedTo?: string;
    }
  ) {
    return prisma.ticket.update({
      where: { id: ticketId },
      data,
    });
  }

  /* =====================================================
     ADMIN LIST WITH FILTERS
  ===================================================== */
  static async listAll(
    where: Prisma.TicketWhereInput,
    skip: number,
    take: number
  ) {
    const [tickets, total] = await prisma.$transaction([
      prisma.ticket.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip,
        take,
        include: {
          user: {
            select: { name: true, phoneNumber: true },
          },
          assignedUser: {
            select: { name: true },
          },
        },
      }),
      prisma.ticket.count({ where }),
    ]);

    return { tickets, total };
  }
}