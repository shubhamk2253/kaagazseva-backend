import { ApplicationStatus, ServiceMode } from '@prisma/client';

/**
 * KAAGAZSEVA - Application Module Types
 * Governs document workflows, lifecycle state, and dashboard queries.
 */

/* -------------------------------------------------
   1️⃣ Document Storage Structure (Matches Prisma JSON)
-------------------------------------------------- */

export interface ApplicationDocuments {
  [documentName: string]: {
    s3Key: string;        // S3 object key
    fileName: string;     // Original filename
    uploadedAt: string;   // ISO string
  };
}

/* -------------------------------------------------
   2️⃣ CREATE INPUT (Citizen submits application)
-------------------------------------------------- */

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

/* -------------------------------------------------
   3️⃣ STATUS UPDATE INPUT (Agent/Admin)
-------------------------------------------------- */

export interface UpdateApplicationStatusInput {
  status: ApplicationStatus;
  remarks?: string;
}

/* -------------------------------------------------
   4️⃣ FILTERS (Dashboard / Pagination)
-------------------------------------------------- */

export interface ApplicationFilters {
  status?: ApplicationStatus;
  serviceType?: string;
  customerId?: string;
  agentId?: string;

  page?: number;
  limit?: number;
}

/* -------------------------------------------------
   5️⃣ DATABASE RESPONSE MODEL
-------------------------------------------------- */

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

/* -------------------------------------------------
   6️⃣ PAGINATED RESPONSE (Dashboard Lists)
-------------------------------------------------- */

export interface PaginatedApplicationResponse {
  applications: ApplicationDetail[];
  total: number;
  totalPages: number;
  currentPage: number;
}