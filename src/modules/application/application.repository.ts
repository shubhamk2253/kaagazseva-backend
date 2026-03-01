import { prisma } from '../../config/database';
import { ApplicationStatus, Prisma } from '@prisma/client';
import { ApplicationFilters } from './application.types';

/**
 * KAAGAZSEVA - Application Repository
 * Enterprise-grade Data Access Layer
 */
export class ApplicationRepository {

  //////////////////////////////////////////////////////
  // CREATE
  //////////////////////////////////////////////////////

  static async create(data: Prisma.ApplicationCreateInput) {
    return prisma.application.create({
      data,
      include: {
        customer: {
          select: { id: true, name: true, phoneNumber: true },
        },
        agent: {
          select: { id: true, name: true, phoneNumber: true },
        },
      },
    });
  }

  //////////////////////////////////////////////////////
  // FIND BY ID
  //////////////////////////////////////////////////////

  static async findById(id: string) {
    return prisma.application.findUnique({
      where: { id },
      include: {
        customer: {
          select: { id: true, name: true, phoneNumber: true },
        },
        agent: {
          select: { id: true, name: true, phoneNumber: true },
        },
      },
    });
  }

  //////////////////////////////////////////////////////
  // FIND ALL (Filters + Pagination)
  //////////////////////////////////////////////////////

  static async findAll(filters: ApplicationFilters) {
    const {
      status,
      serviceType,
      customerId,
      agentId,
      page = 1,
      limit = 10,
    } = filters;

    const safeLimit = Math.min(limit, 50);
    const skip = (page - 1) * safeLimit;

    const where: Prisma.ApplicationWhereInput = {};

    if (status) where.status = status;

    if (serviceType) {
      where.serviceType = {
        equals: serviceType,
        mode: 'insensitive',
      };
    }

    if (customerId) where.customerId = customerId;
    if (agentId) where.agentId = agentId;

    const [applications, total] = await prisma.$transaction([
      prisma.application.findMany({
        where,
        skip,
        take: safeLimit,
        orderBy: { updatedAt: 'desc' },
        include: {
          customer: {
            select: { id: true, name: true, phoneNumber: true },
          },
          agent: {
            select: { id: true, name: true, phoneNumber: true },
          },
        },
      }),
      prisma.application.count({ where }),
    ]);

    return {
      applications,
      total,
      totalPages: Math.ceil(total / safeLimit),
      currentPage: page,
    };
  }

  //////////////////////////////////////////////////////
  // GENERIC UPDATE (🔥 REQUIRED BY SERVICE LAYER)
  //////////////////////////////////////////////////////

  static async update(
    id: string,
    data: Prisma.ApplicationUpdateInput
  ) {
    return prisma.application.update({
      where: { id },
      data,
    });
  }

  //////////////////////////////////////////////////////
  // STATUS UPDATE (Legacy Support)
  //////////////////////////////////////////////////////

  static async updateStatus(
    id: string,
    status: ApplicationStatus,
    agentId?: string
  ) {
    return prisma.application.update({
      where: { id },
      data: {
        status,
        ...(agentId && { agentId }),
      },
    });
  }
}