import { ApplicationRepository } from './application.repository';
import { StorageService } from '../../infrastructure/storage/storage.service';
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
import logger from '../../core/logger';

/**
 * KAAGAZSEVA - Application Service
 * Core Business Intelligence Layer
 */
export class ApplicationService {

  //////////////////////////////////////////////////////
  // 1️⃣ CREATE APPLICATION (Draft + Pricing Lock)
  //////////////////////////////////////////////////////

  static async createApplication(
    customerId: string,
    data: CreateApplicationInput
  ) {

    //////////////////////////////////////////////////////
    // 🚫 Prevent duplicate pending payment applications
    //////////////////////////////////////////////////////

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

    //////////////////////////////////////////////////////
    // 🛡 Basic Validation
    //////////////////////////////////////////////////////

    if (!data.govtFee || data.govtFee <= 0) {
      throw new AppError('Invalid government fee', 400);
    }

    if (!data.mode) {
      throw new AppError('Service mode required', 400);
    }

    //////////////////////////////////////////////////////
    // 💰 CALL PRICING ENGINE
    //////////////////////////////////////////////////////

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

    //////////////////////////////////////////////////////
    // 📦 CREATE APPLICATION WITH LOCKED SNAPSHOT
    //////////////////////////////////////////////////////

    const application = await ApplicationRepository.create({

      customer: { connect: { id: customerId } },

      state: data.state,
      district: data.district,
      serviceType: data.serviceType,
      mode: data.mode as ServiceMode,

      documents: data.documents as any,

      // 🔐 Move directly to PENDING_PAYMENT
      status: ApplicationStatus.PENDING_PAYMENT,

      //////////////////////////////////////////////////////
      // 💰 Pricing Lock
      //////////////////////////////////////////////////////

      govtFee: pricing.govtFee,
      serviceFee: pricing.serviceFee,
      platformCommission: pricing.platformCommission,
      agentCommission: pricing.agentCommission,
      deliveryFee: pricing.deliveryFee,
      totalAmount: pricing.totalAmount,
      distanceKm: pricing.distanceKm ?? null,

      //////////////////////////////////////////////////////
      // 🛡 Immutable Pricing Snapshot
      //////////////////////////////////////////////////////

      pricingSnapshot: {
        ...pricing,
        lockedAt: new Date().toISOString(),
      },
    });

    logger.info(
      `Application ${application.id} created with pricing snapshot | Customer=${customerId}`
    );

    return application;
  }

  //////////////////////////////////////////////////////
  // 2️⃣ LIST APPLICATIONS
  //////////////////////////////////////////////////////

  static async listApplications(filters: ApplicationFilters) {
    return ApplicationRepository.findAll(filters);
  }

  //////////////////////////////////////////////////////
  // 3️⃣ SECURE DETAIL VIEW
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

    const documents = app.documents as Record<string, any>;

    const updatedDocs = await Promise.all(
      Object.entries(documents || {}).map(async ([docKey, value]) => {

        if (!value?.s3Key) {
          return [docKey, value];
        }

        const tempUrl = await StorageService.getSecureAccess(
          value.s3Key
        );

        return [
          docKey,
          {
            ...value,
            tempUrl,
          },
        ];
      })
    );

    return {
      ...app,
      documents: Object.fromEntries(updatedDocs),
    };
  }

  //////////////////////////////////////////////////////
  // 4️⃣ STATUS UPDATE (Agent/Admin)
  //////////////////////////////////////////////////////

  static async updateStatus(
    id: string,
    status: ApplicationStatus,
    updaterId: string
  ) {

    const app = await ApplicationRepository.findById(id);
    if (!app) throw new AppError('Application not found', 404);

    const updateData: any = {
      status,
    };

    //////////////////////////////////////////////////////
    // 🔒 IF COMPLETED → START 24H AUTO RELEASE TIMER
    //////////////////////////////////////////////////////

    if (status === ApplicationStatus.COMPLETED) {

      updateData.completedAt = new Date();

      // 🔥 24-hour escrow protection window
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