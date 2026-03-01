import { z } from 'zod';
import { TicketStatus, TicketPriority, TicketCategory } from '@prisma/client';

/**
 * KAAGAZSEVA - Ticket Validation Schemas
 * Structured validation for grievance redressal system.
 */

export const ticketSchema = {

  /* =====================================================
     CREATE TICKET (Citizen)
  ===================================================== */
  create: z.object({
    body: z.object({
      subject: z
        .string()
        .min(10, "Subject must be at least 10 characters")
        .max(100, "Subject is too long"),

      description: z
        .string()
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

  /* =====================================================
     ADD MESSAGE (Citizen / Staff)
  ===================================================== */
  addMessage: z.object({
    params: z.object({
      id: z.string().uuid("Invalid Ticket ID"),
    }),

    body: z.object({
      message: z
        .string()
        .min(1, "Message cannot be empty")
        .max(1000, "Message too long"),

      attachments: z
        .array(z.string())
        .max(5, "Maximum 5 attachments allowed")
        .optional(),
    }),
  }),

  /* =====================================================
     UPDATE STATUS / ASSIGN (Admin / Agent)
  ===================================================== */
  updateStatus: z.object({
    params: z.object({
      id: z.string().uuid("Invalid Ticket ID"),
    }),

    body: z.object({
      status: z.nativeEnum(TicketStatus).optional(),
      priority: z.nativeEnum(TicketPriority).optional(),
      assignedTo: z.string().uuid("Invalid User ID").optional(),
    }).refine(
      (data) => data.status || data.priority || data.assignedTo,
      {
        message: "At least one field (status, priority, assignedTo) must be provided",
      }
    ),
  }),

};