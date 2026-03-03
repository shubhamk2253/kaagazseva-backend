import { ApplicationRepository } from './application.repository';
import { PricingEngine } from '../pricing/pricing.engine';
import { AppError } from '../../core/AppError';
import {
  ApplicationStatus,
  UserRole,
  ServiceMode,
} from '@prisma/client';
import {
  ApplicationFilters,
  CreateApplicationInput,
} from './application.types';
import { prisma } from '../../config/database';
import logger from '../../core/logger';

export class ApplicationService {

  //////////////////////////////////////////////////////
  // 1️⃣ CREATE DRAFT (PINCODE LOCKED VERSION)
  //////////////////////////////////////////////////////

  static async createDraft(
    customerId: string,
    data: {
      serviceId: string;
      stateId: string;
      pincode: string;
      mode: ServiceMode;
      customerLat?: number;
      customerLng?: number;
      deliveryAddress?: string;
    }
  ) {

    //////////////////////////////////////////////////////
    // 1️⃣ Validate Service
    //////////////////////////////////////////////////////

    const service = await prisma.service.findUnique({
      where: { id: data.serviceId },
      include: { state: true },
    });

    if (!service || !service.isActive) {
      throw new AppError('Invalid or inactive service', 400);
    }

    //////////////////////////////////////////////////////
    // 2️⃣ Validate Pincode Format
    //////////////////////////////////////////////////////

    if (!/^[0-9]{6}$/.test(data.pincode)) {
      throw new AppError('Invalid pincode format', 400);
    }

    //////////////////////////////////////////////////////
    // 3️⃣ Fetch Pincode From DB
    //////////////////////////////////////////////////////

    const pincodeRecord = await prisma.pincode.findUnique({
      where: { code: data.pincode },
      include: { state: true },
    });

    if (!pincodeRecord) {
      throw new AppError('Pincode not found', 404);
    }

    //////////////////////////////////////////////////////
    // 4️⃣ Cross-State Validation
    //////////////////////////////////////////////////////

    if (pincodeRecord.stateId !== service.stateId) {
      throw new AppError(
        'Selected service does not belong to this pincode state',
        400
      );
    }

    if (data.stateId !== service.stateId) {
      throw new AppError(
        'Selected state does not match service state',
        400
      );
    }

    //////////////////////////////////////////////////////
    // 5️⃣ Pricing Engine (DB-driven govtFee)
    //////////////////////////////////////////////////////

    let pricing;

    try {
      pricing = PricingEngine.calculate({
        govtFee: service.govtFee,
        mode: data.mode,
        customerLat: data.customerLat,
        customerLng: data.customerLng,
      });
    } catch (error: any) {
      throw new AppError(error.message, 400);
    }

    //////////////////////////////////////////////////////
    // 6️⃣ Create Secure Draft
    //////////////////////////////////////////////////////

    const draft = await ApplicationRepository.create({

      customer: { connect: { id: customerId } },

      state: service.state.name,
      district: pincodeRecord.district,
      serviceType: service.name,
      mode: data.mode,

      documents: {},

      status: ApplicationStatus.DRAFT,

      govtFee: pricing.govtFee,
      serviceFee: pricing.serviceFee,
      platformCommission: pricing.platformCommission,
      agentCommission: pricing.agentCommission,
      deliveryFee: pricing.deliveryFee,
      totalAmount: pricing.totalAmount,
      distanceKm: pricing.distanceKm ?? null,

      pricingSnapshot: {
        ...pricing,
        pincode: data.pincode,
        district: pincodeRecord.district,
        lockedAt: new Date().toISOString(),
      },

      deliveryAddress: data.deliveryAddress,
      customerLat: data.customerLat,
      customerLng: data.customerLng,
    });

    logger.info(
      `Secure Draft ${draft.id} created | Customer=${customerId}`
    );

    return {
      applicationId: draft.id,
      district: pincodeRecord.district,
      govtFee: pricing.govtFee,
      serviceFee: pricing.serviceFee,
      deliveryFee: pricing.deliveryFee,
      totalAmount: pricing.totalAmount,
    };
  }

  //////////////////////////////////////////////////////
  // 2️⃣ ATTACH DOCUMENTS (🔒 LOCKED AFTER PAYMENT)
  //////////////////////////////////////////////////////

  static async attachDocuments(
    applicationId: string,
    customerId: string,
    documents: Record<string, any>
  ) {

    const app = await ApplicationRepository.findById(applicationId);

    if (!app) {
      throw new AppError('Application not found', 404);
    }

    if (app.customerId !== customerId) {
      throw new AppError('Access denied', 403);
    }

    //////////////////////////////////////////////////////
    // 🔒 HARD LOCK: Only DRAFT allowed
    //////////////////////////////////////////////////////

    if (app.status !== ApplicationStatus.DRAFT) {
      throw new AppError(
        'Documents cannot be modified after payment initiation',
        400
      );
    }

    //////////////////////////////////////////////////////
    // 🔐 Merge documents safely (prevent overwrite attack)
    //////////////////////////////////////////////////////

    const existingDocs =
      (app.documents as Record<string, any>) || {};

    const mergedDocuments = {
      ...existingDocs,
      ...documents,
    };

    return ApplicationRepository.update(applicationId, {
      documents: mergedDocuments,
    });
  }

  //////////////////////////////////////////////////////
  // 3️⃣ LIST
  //////////////////////////////////////////////////////

  static async listApplications(filters: ApplicationFilters) {
    return ApplicationRepository.findAll(filters);
  }

  //////////////////////////////////////////////////////
  // 4️⃣ SECURE DETAIL VIEW
  //////////////////////////////////////////////////////

  static async getApplicationDetails(
    applicationId: string,
    requestorId: string,
    requestorRole: UserRole
  ) {

    const app = await ApplicationRepository.findById(applicationId);
    if (!app) throw new AppError('Application not found', 404);

    const isOwner = app.customerId === requestorId;
    const isAssignedAgent = app.agentId === requestorId;
    const isAdmin =requestorRole === UserRole.STATE_ADMIN ||
    requestorRole === UserRole.DISTRICT_ADMIN ||
    requestorRole === UserRole.FOUNDER;

    if (!isOwner && !isAssignedAgent && !isAdmin) {
      throw new AppError('Access denied to this application', 403);
    }

    return app;
  }

  //////////////////////////////////////////////////////
  // 5️⃣ STATUS UPDATE
  //////////////////////////////////////////////////////

  static async updateStatus(
    id: string,
    status: ApplicationStatus,
    updaterId: string
  ) {

    const app = await ApplicationRepository.findById(id);
    if (!app) throw new AppError('Application not found', 404);

    const updateData: any = { status };

    if (status === ApplicationStatus.COMPLETED) {
      updateData.completedAt = new Date();
      updateData.autoReleaseAt = new Date(
        Date.now() + 24 * 60 * 60 * 1000
      );
    }

    const updated = await ApplicationRepository.update(id, updateData);

    logger.info(
      `Application ${id} moved to ${status} by ${updaterId}`
    );

    return updated;
  }
}