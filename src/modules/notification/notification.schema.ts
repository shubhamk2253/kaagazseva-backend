import { z } from 'zod';

/**
 * KAAGAZSEVA - Notification Validation
 */

export const notificationSchema = {
  filter: z.object({
    query: z.object({
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