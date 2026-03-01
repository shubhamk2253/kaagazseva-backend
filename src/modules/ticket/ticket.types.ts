import { TicketStatus, TicketPriority, TicketCategory } from '@prisma/client';

/**
 * KAAGAZSEVA - Ticket Module Types
 */

/* =====================================================
   Core Ticket
===================================================== */
export interface TicketDetail {
  id: string;
  userId: string;
  subject: string;
  description: string;
  category: TicketCategory;
  status: TicketStatus;
  priority: TicketPriority;
  assignedTo?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/* =====================================================
   Create Ticket Input
===================================================== */
export interface CreateTicketInput {
  subject: string;
  description: string;
  category: TicketCategory;
  priority?: TicketPriority;
}

/* =====================================================
   Ticket Reply / Thread Entry
===================================================== */
export interface TicketResponseDetail {
  id: string;
  ticketId: string;
  senderId: string;
  message: string;
  attachments?: string[] | null;
  createdAt: Date;
}

/* =====================================================
   Filtering (Admin Dashboard)
===================================================== */
export interface TicketFilters {
  status?: TicketStatus;
  category?: TicketCategory;
  priority?: TicketPriority;
  assignedTo?: string;
  page?: number;
  limit?: number;
}