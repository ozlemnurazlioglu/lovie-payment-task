import { z } from 'zod';

export const createRequestSchema = z.object({
  recipient_email: z.string().trim().min(1).email().transform((s) => s.toLowerCase()),
  amount_cents: z.number().int().min(1).max(1_000_000),
  note: z
    .union([
      z
        .string()
        .trim()
        .max(280)
        .transform((s) => (s === '' ? null : s)),
      z.null(),
    ])
    .optional()
    .default(null),
});

export type CreateRequestInput = z.infer<typeof createRequestSchema>;

export const uuidSchema = z.string().uuid();
