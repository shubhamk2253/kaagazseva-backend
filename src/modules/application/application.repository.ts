import { prisma }              from '../../config/database';
import { ApplicationStatus, Prisma } from '@prisma/client';
import { ApplicationFilters }  from './application.types';
import { buildPaginationMeta } from '../../core/types';

/**
 * KAAGAZSEVA - Application Repository
 * Data access layer — no business logic here
 */

// Status → ApplicationTimeline field mapping
const STATUS_TO_TIMELINE_FIELD: Partial<Record<ApplicationStatus, string>> = {
  [ApplicationStatus.PAID]:            'paidAt',
  [ApplicationStatus.ASSIGNING]:       'assigningAt',
  [ApplicationStatus.ASSIGNED]:        'assignedAt',
  [ApplicationStatus.ACCEPTED]:        'acceptedAt',
  [ApplicationStatus.IN_PROGRESS]:     'inProgressAt',
  [ApplicationStatus.DOCS_COLLECTED]:  'docsCollectedAt',
  [ApplicationStatus.SUBMITTED]:       'submittedAt',
  [ApplicationStatus.GOVT_PROCESSING]: 'govtProcessingAt',
  [ApplicationStatus.COMPLETED]:       'completedAt',
  [ApplicationStatus.CONFIRMED]:       'confirmedAt',
  [ApplicationStatus.CLOSED]:          'closedAt',
  [ApplicationStatus.DISPUTED]:        'disputedAt',
  [ApplicationStatus.REFUNDED]:        'refundedAt',
  [ApplicationStatus.CANCELLED]:       'cancelledAt',
};

export class ApplicationRepository {

  /* =====================================================
     INCLUDES
  ===================================================== */

  // List view — lightweight
  private static readonly listInclude = {
    customer: { select: { id: true, name: true, email: true } },
    agent:    { select: { id: true, name: true, email: true } },
    service:  { select: { id: true, name: true, slug: true } },
  } satisfies Prisma.ApplicationInclude;

  // Detail view — full data
  private static readonly detailInclude = {
    customer:  { select: { id: true, name: true, email: true } },
    agent:     { select: { id: true, name: true, email: true } },
    service:   { select: { id: true, name: true, slug: true, estimatedDays: true } },
    documents: true,
    timeline:  true,
    escrow: {
      select: {
        totalAmount:    true,
        platformAmount: true,
        agentAmount:    true,
        isReleased:     true,
        releasedAt:     true,
      },
    },
    history: {
      orderBy: { createdAt: 'desc' as const },
      take:    20,
    },
  } satisfies Prisma.ApplicationInclude;

  /* =====================================================
     CREATE
  ===================================================== */

  static async create(data: Prisma.ApplicationCreateInput) {
    return prisma.application.create({
      data,
      include: this.detailInclude,
    });
  }

  /* =====================================================
     FIND BY ID
  ===================================================== */

  static async findById(id: string) {
    return prisma.application.findUnique({
      where:   { id },
      include: this.detailInclude,
    });
  }

  /* =====================================================
     FIND BY REFERENCE NUMBER
     Used for customer support lookups
  ===================================================== */

  static async findByReferenceNumber(referenceNumber: string) {
    return prisma.application.findUnique({
      where:   { referenceNumber },
      include: this.detailInclude,
    });
  }

  /* =====================================================
     FIND ALL — filters + pagination
  ===================================================== */

  static async findAll(filters: ApplicationFilters) {
    const {
      status,
      serviceId,
      customerId,
      agentId,
      page  = 1,
      limit = 10,
    } = filters;

    const safeLimit = Math.min(limit, 100);
    const skip      = (page - 1) * safeLimit;

    const where: Prisma.ApplicationWhereInput = {};
    if (status)     where.status     = status;
    if (serviceId)  where.serviceId  = serviceId;
    if (customerId) where.customerId = customerId;
    if (agentId)    where.agentId    = agentId;

    const [items, total] = await prisma.$transaction([
      prisma.application.findMany({
        where,
        skip,
        take:    safeLimit,
        orderBy: { updatedAt: 'desc' },
        include: this.listInclude,
      }),
      prisma.application.count({ where }),
    ]);

    return {
      items,
      meta: buildPaginationMeta(page, safeLimit, total),
    };
  }

  /* =====================================================
     GENERIC UPDATE
  ===================================================== */

  static async update(
    id:   string,
    data: Prisma.ApplicationUpdateInput
  ) {
    return prisma.application.update({
      where:   { id },
      data,
      include: this.detailInclude,
    });
  }

  /* =====================================================
     STATUS UPDATE
     Also updates ApplicationTimeline milestone timestamp
  ===================================================== */

  static async updateStatus(
    id:       string,
    status:   ApplicationStatus,
    agentId?: string
  ) {
    const timelineField = STATUS_TO_TIMELINE_FIELD[status];

    return prisma.application.update({
      where: { id },
      data: {
        status,
        ...(agentId && { agentId }),
        // Update timeline milestone for this status
        ...(timelineField && {
          timeline: {
            update: {
              [timelineField]: new Date(),
            },
          },
        }),
      },
      include: this.detailInclude,
    });
  }

  /* =====================================================
     FIND PENDING ASSIGNMENTS
     Used by assignment engine to find unassigned apps
  ===================================================== */

  static async findPendingAssignments() {
    return prisma.application.findMany({
      where: {
        status: ApplicationStatus.ASSIGNING,
        assignmentAttemptCount: { lt: 5 },
      },
      include: this.listInclude,
      orderBy: { createdAt: 'asc' },
    });
  }

  /* =====================================================
     FIND BY AGENT (for agent dashboard)
  ===================================================== */

  static async findByAgent(
    agentId: string,
    status?: ApplicationStatus
  ) {
    return prisma.application.findMany({
      where: {
        agentId,
        ...(status && { status }),
      },
      include: this.listInclude,
      orderBy: { updatedAt: 'desc' },
    });
  }
}