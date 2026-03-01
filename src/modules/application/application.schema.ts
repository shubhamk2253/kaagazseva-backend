import { z } from 'zod';
import { ApplicationStatus } from '@prisma/client';

/**
 * KAAGAZSEVA - Application Validation Schemas
 * GovTech-grade validation for document workflows.
 */

// ----------------------------
// Document Entry Schema
// ----------------------------
const documentEntrySchema = z.object({
  s3Key: z.string().min(1, 'S3 key is required'),

  fileName: z
    .string()
    .min(1, 'Original filename is required')
    .max(255, 'Filename too long'),

  uploadedAt: z
    .string()
    .datetime({ message: 'uploadedAt must be valid ISO datetime' }),
});

// Explicitly type restricted statuses
const statusesRequiringRemarks: ApplicationStatus[] = [
  ApplicationStatus.REJECTED,
  ApplicationStatus.DOCUMENT_REQUIRED,
];

// ----------------------------
// Main Schemas
// ----------------------------
export const applicationSchema = {
  /* =====================================================
     1️⃣ Create Application
  ===================================================== */
  create: z.object({
    body: z.object({
      serviceType: z
        .string()
        .trim()
        .min(3, 'Service type is required')
        .max(50, 'Service type too long')
        .transform((val) => val.toUpperCase()),

      documents: z
        .record(z.string(), documentEntrySchema)
        .refine((docs) => Object.keys(docs).length > 0, {
          message: 'At least one document must be uploaded',
        }),
    }),
  }),

  /* =====================================================
     2️⃣ Update Status (Agent/Admin)
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
     3️⃣ Filter Applications (Dashboard)
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