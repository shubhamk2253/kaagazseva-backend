import { z }                             from 'zod';
import { ApplicationStatus, ServiceMode } from '@prisma/client';

/**
 * KAAGAZSEVA - Application Validation Schemas
 * All fields aligned to locked Prisma schema
 */

/* =====================================================
   STATUS RULES
   Statuses that require a reason/remarks
===================================================== */

const statusesRequiringRemarks: ApplicationStatus[] = [
  ApplicationStatus.REJECTED,
  ApplicationStatus.ON_HOLD,
  ApplicationStatus.DISPUTED,
];

/* =====================================================
   SCHEMAS
===================================================== */

export const applicationSchema = {

  /* =====================================================
     CREATE DRAFT
     POST /api/v1/applications
  ===================================================== */

  createDraft: z.object({
    body: z.object({

      serviceId: z
        .string()
        .uuid('Invalid service ID'),

      stateId: z
        .string()
        .uuid('Invalid state ID'),

      districtId: z
        .string()
        .uuid('Invalid district ID'),

      pincode: z
        .string()
        .regex(/^[0-9]{6}$/, 'Pincode must be 6 digits'),

      mode: z.nativeEnum(ServiceMode),

      customerLat: z
        .number()
        .min(-90,  'Invalid latitude')
        .max(90,   'Invalid latitude')
        .optional(),

      customerLng: z
        .number()
        .min(-180, 'Invalid longitude')
        .max(180,  'Invalid longitude')
        .optional(),

      deliveryAddress: z
        .string()
        .trim()
        .max(500, 'Address too long')
        .optional(),

    }).refine(
      (data) => {
        // Doorstep + Full completion require delivery address
        if (
          data.mode === ServiceMode.DOORSTEP ||
          data.mode === ServiceMode.FULL_COMPLETION
        ) {
          return !!data.deliveryAddress;
        }
        return true;
      },
      {
        message: 'Delivery address is required for doorstep and full completion modes',
        path:    ['deliveryAddress'],
      }
    ),
  }),

  /* =====================================================
     UPDATE STATUS
     PATCH /api/v1/applications/:id/status
  ===================================================== */

  updateStatus: z.object({
    params: z.object({
      id: z.string().uuid('Invalid application ID'),
    }),

    body: z.object({
      status: z.nativeEnum(ApplicationStatus),

      remarks: z
        .string()
        .trim()
        .min(5,   'Remarks too short')
        .max(500, 'Remarks too long')
        .optional(),

    }).refine(
      (data) =>
        !(statusesRequiringRemarks.includes(data.status) && !data.remarks),
      {
        message: 'Remarks are required for this status change',
        path:    ['remarks'],
      }
    ),
  }),

  /* =====================================================
     FILTER — dashboard queries
     GET /api/v1/applications?status=COMPLETED&page=1
  ===================================================== */

  filter: z.object({
    status: z
      .nativeEnum(ApplicationStatus)
      .optional(),

    serviceId: z
      .string()
      .uuid()
      .optional(),

    page: z
      .string()
      .default('1')
      .transform((val) => parseInt(val, 10))
      .pipe(z.number().min(1)),

    limit: z
      .string()
      .default('10')
      .transform((val) => parseInt(val, 10))
      .pipe(z.number().min(1).max(100)),
  }),

  /* =====================================================
     CANCEL APPLICATION
     POST /api/v1/applications/:id/cancel
  ===================================================== */

  cancel: z.object({
    params: z.object({
      id: z.string().uuid('Invalid application ID'),
    }),
    body: z.object({
      reason: z
        .string()
        .trim()
        .min(10, 'Please provide a reason (min 10 characters)')
        .max(500, 'Reason too long'),
    }),
  }),

  /* =====================================================
     CONFIRM COMPLETION
     POST /api/v1/applications/:id/confirm
  ===================================================== */

  confirm: z.object({
    params: z.object({
      id: z.string().uuid('Invalid application ID'),
    }),
  }),

};