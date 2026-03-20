import { ApplicationRepository }  from './application.repository';
import { PricingEngine }          from '../pricing/pricing.engine';
import { AppError, ErrorCodes }   from '../../core/AppError';
import {
  ApplicationStatus,
  UserRole,
  ServiceMode,
  AuditAction,
}                                 from '@prisma/client';
import { ApplicationFilters }     from './application.types';
import { prisma }                 from '../../config/database';
import { QueueService }           from '../../workers/queue.service';
import logger                     from '../../core/logger';

/**
 * KAAGAZSEVA - Application Service
 * Core business logic for application lifecycle
 */

/* =====================================================
   REFERENCE NUMBER GENERATOR
===================================================== */

function generateReferenceNumber(): string {
  const year   = new Date().getFullYear();
  const random = Math.floor(Math.random() * 900000) + 100000;
  return `KS-${year}-${random}`;
}

/* =====================================================
   STATE MACHINE — allowed transitions
===================================================== */

const ALLOWED_TRANSITIONS: Partial
  Record<ApplicationStatus, ApplicationStatus[]>
> = {
  [ApplicationStatus.DRAFT]:           [ApplicationStatus.PENDING_PAYMENT, ApplicationStatus.CANCELLED],
  [ApplicationStatus.PENDING_PAYMENT]: [ApplicationStatus.PAID, ApplicationStatus.CANCELLED],
  [ApplicationStatus.PAID]:            [ApplicationStatus.ASSIGNING],
  [ApplicationStatus.ASSIGNING]:       [ApplicationStatus.ASSIGNED, ApplicationStatus.ON_HOLD],
  [ApplicationStatus.ASSIGNED]:        [ApplicationStatus.ACCEPTED, ApplicationStatus.REASSIGNING],
  [ApplicationStatus.ACCEPTED]:        [ApplicationStatus.IN_PROGRESS],
  [ApplicationStatus.IN_PROGRESS]:     [ApplicationStatus.DOCS_COLLECTED, ApplicationStatus.SUBMITTED, ApplicationStatus.DISPUTED],
  [ApplicationStatus.DOCS_COLLECTED]:  [ApplicationStatus.SUBMITTED],
  [ApplicationStatus.SUBMITTED]:       [ApplicationStatus.GOVT_PROCESSING, ApplicationStatus.COMPLETED],
  [ApplicationStatus.GOVT_PROCESSING]: [ApplicationStatus.COMPLETED, ApplicationStatus.DISPUTED],
  [ApplicationStatus.COMPLETED]:       [ApplicationStatus.CONFIRMED, ApplicationStatus.DISPUTED],
  [ApplicationStatus.CONFIRMED]:       [ApplicationStatus.CLOSED],
  [ApplicationStatus.REASSIGNING]:     [ApplicationStatus.ASSIGNING],
  [ApplicationStatus.DISPUTED]:        [ApplicationStatus.REFUND_PENDING, ApplicationStatus.CLOSED],
  [ApplicationStatus.REFUND_PENDING]:  [ApplicationStatus.REFUNDED],
};

/* =====================================================
   SERVICE
===================================================== */

export class ApplicationService {

  /* =====================================================
     1. CREATE DRAFT
  ===================================================== */

  static async createDraft(
    customerId: string,
    data: {
      serviceId:       string;
      stateId:         string;
      districtId:      string;
      pincode:         string;
      mode:            ServiceMode;
      customerLat?:    number;
      customerLng?:    number;
      deliveryAddress?: string;
    }
  ) {
    // 1. Validate service exists and is active
    const service = await prisma.service.findUnique({
      where: { id: data.serviceId },
    });

    if (!service || !service.isActive) {
      throw new AppError(
        'Invalid or inactive service',
        400, true, ErrorCodes.SERVICE_NOT_FOUND
      );
    }

    // 2. Validate pincode
    const pincodeRecord = await prisma.pincode.findUnique({
      where: { code: data.pincode },
    });

    if (!pincodeRecord) {
      throw new AppError(
        'Pincode not found',
        404, true, ErrorCodes.INVALID_PINCODE
      );
    }

    // 3. State validation — only for STATE-scoped services
    if (service.scope === 'STATE' && service.stateId) {
      if (pincodeRecord.stateId !== service.stateId) {
        throw new AppError(
          'This service is not available in your state',
          400, true, ErrorCodes.SERVICE_UNAVAILABLE
        );
      }
    }

    // 4. Get pricing rule
    const pricingRule = await prisma.pricingRule.findFirst({
      where: {
        serviceId: service.id,
        mode:      data.mode,
        isActive:  true,
      },
    });

    if (!pricingRule) {
      throw new AppError(
        'Pricing not configured for this service and mode',
        500, true, ErrorCodes.SERVICE_UNAVAILABLE
      );
    }

    // 5. Calculate pricing
    let pricing;
    try {
      pricing = PricingEngine.calculate({
        govtFee:     Number(pricingRule.minGovtFee),
        mode:        data.mode,
        customerLat: data.customerLat,
        customerLng: data.customerLng,
      });
    } catch (error: any) {
      throw new AppError(error.message, 400);
    }

    // 6. Create draft
    const draft = await ApplicationRepository.create({
      referenceNumber: generateReferenceNumber(),

      customer:  { connect: { id: customerId } },
      service:   { connect: { id: service.id } },
      state:     { connect: { id: pincodeRecord.stateId } },
      district:  { connect: { id: pincodeRecord.districtId } },

      mode:   data.mode,
      status: ApplicationStatus.DRAFT,

      // Pricing snapshot — immutable after payment
      govtFee:            pricing.govtFee,
      serviceFee:         pricing.serviceFee,
      platformCommission: pricing.platformCommission,
      agentCommission:    pricing.agentCommission,
      deliveryFee:        pricing.deliveryFee,
      totalAmount:        pricing.totalAmount,
      distanceKm:         pricing.distanceKm,

      pricingSnapshot: {
        ...pricing,
        pincode:    data.pincode,
        lockedAt:   new Date().toISOString(),
        ruleId:     pricingRule.id,
      },

      customerLat:     data.customerLat,
      customerLng:     data.customerLng,
      customerPincode: data.pincode,
      deliveryAddress: data.deliveryAddress,
    });

    logger.info({
      event:         'APPLICATION_DRAFT_CREATED',
      applicationId: draft.id,
      customerId,
      serviceId:     service.id,
      mode:          data.mode,
    });

    return {
      applicationId:   draft.id,
      referenceNumber: draft.referenceNumber,
      govtFee:         pricing.govtFee,
      serviceFee:      pricing.serviceFee,
      deliveryFee:     pricing.deliveryFee,
      totalAmount:     pricing.totalAmount,
    };
  }

  /* =====================================================
     2. ATTACH DOCUMENTS
  ===================================================== */

  static async attachDocuments(
    applicationId: string,
    customerId:    string,
    documents: {
      name:     string;
      fileUrl:  string;
      fileSize?: number;
      mimeType?: string;
    }[]
  ) {
    const app = await ApplicationRepository.findById(applicationId);

    if (!app) {
      throw AppError.notFound('Application not found', ErrorCodes.APPLICATION_NOT_FOUND);
    }
    if (app.customerId !== customerId) {
      throw AppError.forbidden('Access denied', ErrorCodes.FORBIDDEN);
    }
    if (app.status !== ApplicationStatus.DRAFT) {
      throw new AppError(
        'Documents cannot be modified after payment',
        400, true, ErrorCodes.INVALID_STATUS_CHANGE
      );
    }

    await prisma.applicationDocument.createMany({
      data: documents.map(doc => ({
        applicationId,
        name:     doc.name,
        fileUrl:  doc.fileUrl,
        fileSize: doc.fileSize,
        mimeType: doc.mimeType,
      })),
    });

    return ApplicationRepository.findById(applicationId);
  }

  /* =====================================================
     3. LIST APPLICATIONS
  ===================================================== */

  static async listApplications(filters: ApplicationFilters) {
    return ApplicationRepository.findAll(filters);
  }

  /* =====================================================
     4. GET APPLICATION DETAILS
  ===================================================== */

  static async getApplicationDetails(
    applicationId: string,
    requestorId:   string,
    requestorRole: UserRole
  ) {
    const app = await ApplicationRepository.findById(applicationId);

    if (!app) {
      throw AppError.notFound('Application not found', ErrorCodes.APPLICATION_NOT_FOUND);
    }

    const isOwner         = app.customerId === requestorId;
    const isAssignedAgent = app.agentId    === requestorId;
    const isAdmin         = [
      UserRole.STATE_ADMIN,
      UserRole.DISTRICT_ADMIN,
      UserRole.FOUNDER,
    ].includes(requestorRole);

    if (!isOwner && !isAssignedAgent && !isAdmin) {
      throw AppError.forbidden('Access denied', ErrorCodes.FORBIDDEN);
    }

    return app;
  }

  /* =====================================================
     5. UPDATE STATUS — with state machine validation
  ===================================================== */

  static async updateStatus(
    id:        string,
    status:    ApplicationStatus,
    updaterId: string,
    role:      UserRole
  ) {
    const app = await ApplicationRepository.findById(id);

    if (!app) {
      throw AppError.notFound('Application not found', ErrorCodes.APPLICATION_NOT_FOUND);
    }

    // Validate transition
    const allowed = ALLOWED_TRANSITIONS[app.status as ApplicationStatus] ?? [];
    if (!allowed.includes(status)) {
      throw AppError.invalidStatusTransition(app.status, status);
    }

    const updated = await ApplicationRepository.updateStatus(id, status);

    // Write audit log
    await prisma.auditLog.create({
      data: {
        userId:       updaterId,
        action:       AuditAction.STATUS_CHANGE,
        resourceType: 'Application',
        resourceId:   id,
        oldData:      { status: app.status },
        newData:      { status },
        success:      true,
      },
    });

    logger.info({
      event:         'APPLICATION_STATUS_CHANGED',
      applicationId: id,
      from:          app.status,
      to:            status,
      updatedBy:     updaterId,
      role,
    });

    return updated;
  }

  /* =====================================================
     6. CONFIRM COMPLETION
     Customer confirms → triggers agent payout
  ===================================================== */

  static async confirmCompletion(
    applicationId: string,
    customerId:    string
  ) {
    const app = await ApplicationRepository.findById(applicationId);

    if (!app) {
      throw AppError.notFound('Application not found', ErrorCodes.APPLICATION_NOT_FOUND);
    }
    if (app.customerId !== customerId) {
      throw AppError.forbidden('Access denied', ErrorCodes.FORBIDDEN);
    }
    if (app.status !== ApplicationStatus.COMPLETED) {
      throw new AppError(
        'Application is not ready for confirmation',
        400, true, ErrorCodes.INVALID_STATUS_CHANGE
      );
    }

    // Update status to CONFIRMED
    const updated = await ApplicationRepository.updateStatus(
      applicationId,
      ApplicationStatus.CONFIRMED
    );

    // Trigger payout release via BullMQ
    await QueueService.addPaymentJob({
      type:          'RELEASE_ESCROW',
      applicationId,
      agentId:       app.agentId ?? undefined,
    });

    logger.info({
      event:         'APPLICATION_COMPLETION_CONFIRMED',
      applicationId,
      customerId,
    });

    return updated;
  }

  /* =====================================================
     7. CANCEL APPLICATION
  ===================================================== */

  static async cancelApplication(
    applicationId: string,
    userId:        string,
    reason:        string
  ) {
    const app = await ApplicationRepository.findById(applicationId);

    if (!app) {
      throw AppError.notFound('Application not found', ErrorCodes.APPLICATION_NOT_FOUND);
    }

    // Only customer or admin can cancel
    const isCancellable = [
      ApplicationStatus.DRAFT,
      ApplicationStatus.PENDING_PAYMENT,
    ].includes(app.status as ApplicationStatus);

    if (!isCancellable) {
      throw new AppError(
        'Application cannot be cancelled at this stage',
        400, true, ErrorCodes.INVALID_STATUS_CHANGE
      );
    }

    if (app.customerId !== userId) {
      throw AppError.forbidden('Access denied', ErrorCodes.FORBIDDEN);
    }

    const updated = await ApplicationRepository.updateStatus(
      applicationId,
      ApplicationStatus.CANCELLED
    );

    // Write cancellation reason to audit log
    await prisma.auditLog.create({
      data: {
        userId,
        action:       AuditAction.STATUS_CHANGE,
        resourceType: 'Application',
        resourceId:   applicationId,
        oldData:      { status: app.status },
        newData:      { status: ApplicationStatus.CANCELLED, reason },
        success:      true,
      },
    });

    logger.info({
      event:         'APPLICATION_CANCELLED',
      applicationId,
      cancelledBy:   userId,
      reason,
    });

    return updated;
  }
}