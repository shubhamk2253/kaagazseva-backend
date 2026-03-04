import { prisma } from '../../config/database';
import {
  TicketStatus,
  TicketPriority,
  TicketCategory,
  Prisma,
} from '@prisma/client';
import { CreateTicketInput } from './ticket.types';

/**
 * KAAGAZSEVA - Ticket Repository (Schema Aligned)
 */
export class TicketRepository {

  //////////////////////////////////////////////////////
  // CREATE TICKET
  //////////////////////////////////////////////////////

  static async create(
    userId: string,
    data: CreateTicketInput
  ) {
    return prisma.ticket.create({
      data: {
        title: data.subject, // map subject → title
        description: data.description,
        category: data.category as TicketCategory,
        priority: data.priority || TicketPriority.MEDIUM,
        status: TicketStatus.OPEN,
        createdById: userId,
      },
    });
  }

  //////////////////////////////////////////////////////
  // GET TICKET WITH FULL THREAD
  //////////////////////////////////////////////////////

  static async findByIdWithResponses(id: string) {
    return prisma.ticket.findUnique({
      where: { id },
      include: {
        responses: {
          orderBy: { createdAt: 'asc' },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                role: true,
              },
            },
          },
        },
        createdBy: {
          select: {
            id: true,
            name: true,
            phoneNumber: true,
            role: true,
          },
        },
        assignedTo: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  //////////////////////////////////////////////////////
  // ADD MESSAGE TO THREAD
  //////////////////////////////////////////////////////

  static async addResponse(
    ticketId: string,
    senderId: string,
    message: string
  ) {
    return prisma.$transaction(async (tx) => {

      const response = await tx.ticketResponse.create({
        data: {
          ticketId,
          userId: senderId,
          message,
        },
      });

      await tx.ticket.update({
        where: { id: ticketId },
        data: { updatedAt: new Date() },
      });

      return response;
    });
  }

  //////////////////////////////////////////////////////
  // UPDATE STATUS / ASSIGN
  //////////////////////////////////////////////////////

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
      data: {
        status: data.status,
        priority: data.priority,
        ...(data.assignedTo && {
          assignedTo: {
            connect: { id: data.assignedTo },
          },
        }),
      },
    });
  }

  //////////////////////////////////////////////////////
  // STATE_ADMIN LIST WITH FILTERS
  //////////////////////////////////////////////////////

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
          createdBy: {
            select: { name: true, phoneNumber: true },
          },
          assignedTo: {
            select: { name: true },
          },
        },
      }),
      prisma.ticket.count({ where }),
    ]);

    return { tickets, total };
  }
}