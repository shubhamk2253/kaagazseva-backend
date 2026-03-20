import { ApplicationStatus, ServiceMode } from '@prisma/client';
import { PaginationMeta }                 from '../../core/types';

/**
 * KAAGAZSEVA - Application Module Types
 * Aligned to locked Prisma schema
 */

/* =====================================================
   DOCUMENT STRUCTURE
   Stored in ApplicationDocument model
===================================================== */

export interface ApplicationDocumentInput {
  name:      string;
  fileUrl:   string;  // S3 key
  fileSize?: number;
  mimeType?: string;
}

/* =====================================================
   CREATE DRAFT INPUT
===================================================== */

export interface CreateDraftInput {
  serviceId:        string;
  stateId:          string;
  districtId:       string;  // ← added, required
  pincode:          string;
  mode:             ServiceMode;
  customerLat?:     number;
  customerLng?:     number;
  deliveryAddress?: string;
}

/* =====================================================
   STATUS UPDATE INPUT
===================================================== */

export interface UpdateApplicationStatusInput {
  status:   ApplicationStatus;
  remarks?: string;
}

/* =====================================================
   FILTERS — dashboard + pagination
===================================================== */

export interface ApplicationFilters {
  status?:     ApplicationStatus;
  serviceId?:  string;          // UUID FK
  customerId?: string;
  agentId?:    string;
  page?:       number;
  limit?:      number;
}

/* =====================================================
   APPLICATION DETAIL RESPONSE
   Matches ApplicationRepository detailInclude shape
===================================================== */

export interface ApplicationDetail {
  id:              string;
  referenceNumber: string;
  status:          ApplicationStatus;
  mode:            ServiceMode;

  // Relations
  customer?: { id: string; name: string | null; email: string | null };
  agent?:    { id: string; name: string | null; email: string | null } | null;
  service?:  { id: string; name: string; slug: string };

  // Pricing (immutable after payment)
  govtFee:            number;
  serviceFee:         number;
  platformCommission: number;
  agentCommission:    number;
  deliveryFee:        number;
  totalAmount:        number;
  distanceKm?:        number | null;
  pricingSnapshot?:   object | null;

  // Payment
  paymentStatus:    string;
  paidAt?:          Date | null;
  razorpayOrderId?: string | null;

  // Location (snapshot)
  customerLat?:     number | null;
  customerLng?:     number | null;
  customerPincode?: string | null;
  deliveryAddress?: string | null;

  // Assignment
  assignmentDeadline?:     Date | null;
  assignedAt?:             Date | null;
  acceptedAt?:             Date | null;
  assignmentAttemptCount:  number;

  // Completion
  completedAt?:        Date | null;
  confirmedAt?:        Date | null;
  closedAt?:           Date | null;
  completionProofUrl?: string | null;
  govtAckReceiptUrl?:  string | null;

  // Risk
  riskScore:      number;
  manualReview:   boolean;
  escalationLevel: number;
  refundRequested: boolean;

  // Ratings
  customerRating?: number | null;
  agentRating?:    number | null;

  createdAt: Date;
  updatedAt: Date;
}

/* =====================================================
   PAGINATED RESPONSE
   Matches ApplicationRepository.findAll() output
===================================================== */

export interface PaginatedApplicationResponse {
  items: ApplicationDetail[];
  meta:  PaginationMeta;
}

/* =====================================================
   PRICING SNAPSHOT STRUCTURE
   Stored in Application.pricingSnapshot JSON field
===================================================== */

export interface PricingSnapshot {
  govtFee:            number;
  multiplier:         number;
  serviceFee:         number;
  platformCommission: number;
  agentCommission:    number;
  deliveryFee:        number;
  distanceKm:         number;
  totalAmount:        number;
  pincode:            string;
  ruleId:             string;
  lockedAt:           string; // ISO date
}