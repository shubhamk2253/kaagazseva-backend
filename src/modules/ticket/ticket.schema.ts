import { z } from 'zod';
import {
  TicketStatus,
  TicketPriority,
  TicketCategory
} from '@prisma/client';

/**
 * KAAGAZSEVA - Ticket Validation Schemas
 */

export const ticketSchema = {

  //////////////////////////////////////////////////////
  // PARAM VALIDATION
  //////////////////////////////////////////////////////

  params: z.object({
    params: z.object({
      id: z.string().uuid("Invalid Ticket ID"),
    }),
  }),

  //////////////////////////////////////////////////////
  // CREATE TICKET
  //////////////////////////////////////////////////////

  create: z.object({
    body: z.object({

      subject: z
        .string()
        .trim()
        .min(10, "Subject must be at least 10 characters")
        .max(100, "Subject is too long"),

      description: z
        .string()
        .trim()
        .min(20, "Please provide more detail (minimum 20 characters)")
        .max(1000, "Description cannot exceed 1000 characters"),

      category: z.nativeEnum(TicketCategory),

      priority: z.nativeEnum(TicketPriority).optional(),

      applicationId: z
        .string()
        .uuid("Invalid Application ID format")
        .optional(),

    }),
  }),

  //////////////////////////////////////////////////////
  // ADD MESSAGE
  //////////////////////////////////////////////////////

  addMessage: z.object({

    params: z.object({
      id: z.string().uuid("Invalid Ticket ID"),
    }),

    body: z.object({

      message: z
        .string()
        .trim()
        .min(1, "Message cannot be empty")
        .max(1000, "Message too long"),

      attachments: z
        .array(
          z.string().url("Attachment must be a valid URL")
        )
        .max(5, "Maximum 5 attachments allowed")
        .optional(),

    }),

  }),

  //////////////////////////////////////////////////////
  // UPDATE STATUS
  //////////////////////////////////////////////////////

  updateStatus: z.object({

    params: z.object({
      id: z.string().uuid("Invalid Ticket ID"),
    }),

    body: z.object({

      status: z.nativeEnum(TicketStatus).optional(),

      priority: z.nativeEnum(TicketPriority).optional(),

      assignedTo: z
        .string()
        .uuid("Invalid User ID")
        .optional(),

    }).refine(
      (data) =>
        data.status !== undefined ||
        data.priority !== undefined ||
        data.assignedTo !== undefined,
      {
        message:
          "At least one field (status, priority, assignedTo) must be provided",
      }
    ),

  }),

};