import { z } from 'zod';
import { ApplicationStatus, ServiceMode } from '@prisma/client';

/**
 * KAAGAZSEVA - Application Validation Schemas
 * Updated for DRAFT-first architecture
 */

// =====================================================
// STATUS RULES
// =====================================================

const statusesRequiringRemarks: ApplicationStatus[] = [
  ApplicationStatus.REJECTED,
  ApplicationStatus.DOCUMENT_REQUIRED,
];

// =====================================================
// MAIN SCHEMAS
// =====================================================

export const applicationSchema = {

  /* =====================================================
     1️⃣ CREATE DRAFT
     POST /applications/draft
  ===================================================== */
  createDraft: z.object({
    body: z.object({

      serviceId: z
        .string()
        .uuid('Invalid Service ID'),

      district: z
        .string()
        .trim()
        .min(2, 'District is required')
        .max(100, 'District name too long'),

      mode: z.nativeEnum(ServiceMode),

      customerLat: z
        .number()
        .min(-90)
        .max(90)
        .optional(),

      customerLng: z
        .number()
        .min(-180)
        .max(180)
        .optional(),

      deliveryAddress: z
        .string()
        .trim()
        .max(500)
        .optional(),
    }),
  }),

  /* =====================================================
     2️⃣ UPDATE STATUS (STATE_ADMIN / AGENT)
  ===================================================== */
  updateStatus: z.object({
    params: z.object({
      id: z.string().uuid('Invalid Application ID'),
    }),

    body: z
      .object({
        status: z.nativeEnum(ApplicationStatus),

        remarks: z
          .string()
          .trim()
          .max(500, 'Remarks cannot exceed 500 characters')
          .optional(),
      })
      .refine(
        (data) =>
          !(
            statusesRequiringRemarks.includes(data.status) &&
            !data.remarks
          ),
        {
          message:
            'Remarks are required when rejecting or requesting documents',
          path: ['remarks'],
        }
      ),
  }),

  /* =====================================================
     3️⃣ FILTER APPLICATIONS (Dashboard)
  ===================================================== */
  filter: z.object({
    query: z.object({

      status: z.nativeEnum(ApplicationStatus).optional(),

      serviceType: z
        .string()
        .trim()
        .max(50)
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
        .pipe(z.number().min(1).max(50)),
    }),
  }),
};