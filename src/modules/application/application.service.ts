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

/**
 * KAAGAZSEVA - Application Service
 * Draft → Upload → Payment → Escrow → Assignment
 */
export class ApplicationService {

  //////////////////////////////////////////////////////
  // 1️⃣ CREATE DRAFT (NEW FLOW)
  //////////////////////////////////////////////////////

  static async createDraft(
    customerId: string,
    data: {
      serviceId: string;
      state: string;
      district: string;
      mode: ServiceMode;
      customerLat?: number;
      customerLng?: number;
      deliveryAddress?: string;
    }
  ) {

    const service = await prisma.service.findUnique({
      where: { id: data.serviceId },
    });

    if (!service || !service.isActive) {
      throw new AppError('Invalid or inactive service', 400);
    }

    const govtFee = service.govtFee;

    let pricing;

    try {
      pricing = PricingEngine.calculate({
        govtFee,
        mode: data.mode,
        customerLat: data.customerLat,
        customerLng: data.customerLng,
      });
    } catch (error: any) {
      throw new AppError(error.message, 400);
    }

    const draft = await ApplicationRepository.create({

      customer: { connect: { id: customerId } },

      state: data.state,
      district: data.district,
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
        lockedAt: new Date().toISOString(),
      },

      deliveryAddress: data.deliveryAddress,
      customerLat: data.customerLat,
      customerLng: data.customerLng,
    });

    logger.info(
      `Draft ${draft.id} created | Customer=${customerId}`
    );

    return draft;
  }

  //////////////////////////////////////////////////////
  // 2️⃣ ATTACH DOCUMENTS TO DRAFT
  //////////////////////////////////////////////////////

  static async attachDocuments(
    applicationId: string,
    customerId: string,
    documents: Record<string, any>
  ) {

    const app = await ApplicationRepository.findById(applicationId);

    if (!app) throw new AppError('Application not found', 404);

    if (app.customerId !== customerId) {
      throw new AppError('Access denied', 403);
    }

    if (app.status !== ApplicationStatus.DRAFT) {
      throw new AppError(
        'Documents can only be uploaded to DRAFT application',
        400
      );
    }

    const updated = await ApplicationRepository.update(
      applicationId,
      {
        documents,
      }
    );

    return updated;
  }

  //////////////////////////////////////////////////////
  // LEGACY CREATE (KEEP SAFE)
  //////////////////////////////////////////////////////

  static async createApplication(
    customerId: string,
    data: CreateApplicationInput
  ) {

    const existing = await ApplicationRepository.findAll({
      customerId,
      status: ApplicationStatus.PENDING_PAYMENT,
      serviceType: data.serviceType,
      limit: 1,
      page: 1,
    });

    if (existing.total > 0) {
      throw new AppError(
        `You already have a pending ${data.serviceType} application.`,
        400
      );
    }

    if (!data.govtFee || data.govtFee <= 0) {
      throw new AppError('Invalid government fee', 400);
    }

    if (!data.mode) {
      throw new AppError('Service mode required', 400);
    }

    let pricing;

    try {
      pricing = PricingEngine.calculate({
        govtFee: data.govtFee,
        mode: data.mode as ServiceMode,
        customerLat: data.customerLat,
        customerLng: data.customerLng,
      });
    } catch (error: any) {
      throw new AppError(error.message, 400);
    }

    const application = await ApplicationRepository.create({

      customer: { connect: { id: customerId } },

      state: data.state,
      district: data.district,
      serviceType: data.serviceType,
      mode: data.mode as ServiceMode,

      documents: data.documents as any,

      status: ApplicationStatus.PENDING_PAYMENT,

      govtFee: pricing.govtFee,
      serviceFee: pricing.serviceFee,
      platformCommission: pricing.platformCommission,
      agentCommission: pricing.agentCommission,
      deliveryFee: pricing.deliveryFee,
      totalAmount: pricing.totalAmount,
      distanceKm: pricing.distanceKm ?? null,

      pricingSnapshot: {
        ...pricing,
        lockedAt: new Date().toISOString(),
      },
    });

    return application;
  }

  //////////////////////////////////////////////////////
  // LIST
  //////////////////////////////////////////////////////

  static async listApplications(filters: ApplicationFilters) {
    return ApplicationRepository.findAll(filters);
  }

  //////////////////////////////////////////////////////
  // SECURE DETAIL VIEW
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
    const isAdmin = requestorRole === UserRole.ADMIN;

    if (!isOwner && !isAssignedAgent && !isAdmin) {
      throw new AppError('Access denied to this application', 403);
    }

    return app;
  }

  //////////////////////////////////////////////////////
  // STATUS UPDATE
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

    const updated = await ApplicationRepository.update(
      id,
      updateData
    );

    logger.info(
      `Application ${id} moved to ${status} by ${updaterId}`
    );

    return updated;
  }
}