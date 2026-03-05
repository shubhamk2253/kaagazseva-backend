import { ApplicationRepository } from './application.repository';
import { PricingEngine } from '../pricing/pricing.engine';
import { AppError } from '../../core/AppError';
import {
  ApplicationStatus,
  UserRole,
  ServiceMode,
} from '@prisma/client';
import { ApplicationFilters } from './application.types';
import { prisma } from '../../config/database';
import logger from '../../core/logger';

export class ApplicationService {

  //////////////////////////////////////////////////////
  // 1️⃣ CREATE DRAFT
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
    // Validate Service
    //////////////////////////////////////////////////////

    const service = await prisma.service.findUnique({
      where: { id: data.serviceId },
      include: { state: true },
    });

    if (!service || !service.isActive) {
      throw new AppError('Invalid or inactive service', 400);
    }

    //////////////////////////////////////////////////////
    // Validate Pincode
    //////////////////////////////////////////////////////

    if (!/^[0-9]{6}$/.test(data.pincode)) {
      throw new AppError('Invalid pincode format', 400);
    }

    const pincodeRecord = await prisma.pincode.findUnique({
      where: { code: data.pincode },
      include: { state: true },
    });

    if (!pincodeRecord) {
      throw new AppError('Pincode not found', 404);
    }

    //////////////////////////////////////////////////////
    // Cross-state validation
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
    // Fetch Pricing Rule
    //////////////////////////////////////////////////////

    const pricingRule = await prisma.pricingRule.findFirst({
      where: {
        serviceId: service.id,
        mode: data.mode,
        isActive: true,
      },
    });

    if (!pricingRule) {
      throw new AppError('Pricing rule not configured for this service', 500);
    }

    const govtFee = Number(pricingRule.minGovtFee);

    //////////////////////////////////////////////////////
    // Pricing Engine
    //////////////////////////////////////////////////////

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

    //////////////////////////////////////////////////////
    // Create Draft
    //////////////////////////////////////////////////////

    const draft = await ApplicationRepository.create({
      
      customer: {
        connect: { id: customerId }
      },
      service: {
        connect: { id: service.id }
      },
      
      serviceType: service.name,
      
      state: service.state.name,
      district: pincodeRecord.district,
      mode: data.mode,
      status: ApplicationStatus.DRAFT,
      
      govtFee: pricing.govtFee,
      serviceFee: pricing.serviceFee,
      platformCommission: pricing.platformCommission,
      agentCommission: pricing.agentCommission,
      deliveryFee: pricing.deliveryFee,
      totalAmount: pricing.totalAmount,
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
      `Draft ${draft.id} created | Customer=${customerId}`
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
  // 2️⃣ ATTACH DOCUMENTS
  //////////////////////////////////////////////////////

  static async attachDocuments(
    applicationId: string,
    customerId: string,
    documents: { name: string; fileUrl: string }[]
  ) {

    const app = await ApplicationRepository.findById(applicationId);

    if (!app) {
      throw new AppError('Application not found', 404);
    }

    if (app.customerId !== customerId) {
      throw new AppError('Access denied', 403);
    }

    if (app.status !== ApplicationStatus.DRAFT) {
      throw new AppError(
        'Documents cannot be modified after payment initiation',
        400
      );
    }

    await prisma.applicationDocument.createMany({
      data: documents.map(doc => ({
        applicationId,
        name: doc.name,
        fileUrl: doc.fileUrl,
      })),
    });

    return ApplicationRepository.findById(applicationId);
  }

  //////////////////////////////////////////////////////
  // 3️⃣ LIST APPLICATIONS
  //////////////////////////////////////////////////////

  static async listApplications(filters: ApplicationFilters) {
    return ApplicationRepository.findAll(filters);
  }

  //////////////////////////////////////////////////////
  // 4️⃣ GET APPLICATION DETAILS
  //////////////////////////////////////////////////////

  static async getApplicationDetails(
    applicationId: string,
    requestorId: string,
    requestorRole: UserRole
  ) {

    const app = await ApplicationRepository.findById(applicationId);

    if (!app) {
      throw new AppError('Application not found', 404);
    }

    const isOwner = app.customerId === requestorId;
    const isAssignedAgent = app.agentId === requestorId;

    const isAdmin =
      requestorRole === UserRole.STATE_ADMIN ||
      requestorRole === UserRole.DISTRICT_ADMIN ||
      requestorRole === UserRole.FOUNDER;

    if (!isOwner && !isAssignedAgent && !isAdmin) {
      throw new AppError('Access denied to this application', 403);
    }

    return app;
  }

  //////////////////////////////////////////////////////
  // 5️⃣ UPDATE STATUS
  //////////////////////////////////////////////////////

  static async updateStatus(
    id: string,
    status: ApplicationStatus,
    updaterId: string
  ) {

    const app = await ApplicationRepository.findById(id);

    if (!app) {
      throw new AppError('Application not found', 404);
    }

    const updateData: any = { status };

    if (status === ApplicationStatus.COMPLETED) {
      updateData.completedAt = new Date();
    }

    const updated = await ApplicationRepository.update(id, updateData);

    logger.info(
      `Application ${id} moved to ${status} by ${updaterId}`
    );

    return updated;
  }

}