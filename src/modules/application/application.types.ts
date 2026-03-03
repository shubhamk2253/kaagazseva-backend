import { ApplicationStatus, ServiceMode } from '@prisma/client';

/**
 * KAAGAZSEVA - Application Module Types
 * Founder-grade architecture
 * Draft → Payment → Escrow → Assignment
 */

/* =====================================================
   1️⃣ DOCUMENT STRUCTURE (Stored as Prisma JSON)
===================================================== */

export interface ApplicationDocuments {
  [documentName: string]: {
    s3Key: string;
    fileName: string;
    uploadedAt: string; // ISO string
  };
}

/* =====================================================
   2️⃣ CREATE DRAFT INPUT (PHASE 1 HARDENED)
   - No manual district
   - Pincode required
   - StateId required
===================================================== */

export interface CreateDraftInput {
  serviceId: string;
  stateId: string;
  pincode: string;
  mode: ServiceMode;

  customerLat?: number;
  customerLng?: number;

  deliveryAddress?: string;

  documents?: ApplicationDocuments;
}

/* =====================================================
   3️⃣ LEGACY CREATE INPUT (Kept for safety if needed)
   ⚠️ Not recommended for frontend usage
===================================================== */

export interface CreateApplicationInput {
  serviceType: string;

  state: string;
  district: string;

  govtFee: number;
  mode: ServiceMode;

  customerLat?: number;
  customerLng?: number;

  deliveryAddress?: string;

  documents: ApplicationDocuments;
}

/* =====================================================
   4️⃣ STATUS UPDATE INPUT (Agent/Admin)
===================================================== */

export interface UpdateApplicationStatusInput {
  status: ApplicationStatus;
  remarks?: string;
}

/* =====================================================
   5️⃣ FILTERS (Dashboard / Pagination)
===================================================== */

export interface ApplicationFilters {
  status?: ApplicationStatus;
  serviceType?: string;
  customerId?: string;
  agentId?: string;

  page?: number;
  limit?: number;
}

/* =====================================================
   6️⃣ DATABASE RESPONSE MODEL
===================================================== */

export interface ApplicationDetail {
  id: string;

  serviceType: string;
  state: string;
  district: string;

  status: ApplicationStatus;

  documents: ApplicationDocuments;

  govtFee: number;
  serviceFee: number;
  platformCommission: number;
  agentCommission: number;
  deliveryFee: number;
  totalAmount: number;

  distanceKm?: number | null;

  paymentStatus: string;
  paidAt?: Date | null;

  customerId: string;
  agentId?: string | null;

  assignmentDeadline?: Date | null;
  assignedAt?: Date | null;
  acceptedAt?: Date | null;

  completedAt?: Date | null;
  autoReleaseAt?: Date | null;

  riskScore: number;
  manualReview: boolean;
  refundRequested: boolean;

  createdAt: Date;
  updatedAt: Date;
}

/* =====================================================
   7️⃣ PAGINATED RESPONSE
===================================================== */

export interface PaginatedApplicationResponse {
  applications: ApplicationDetail[];
  total: number;
  totalPages: number;
  currentPage: number;
}