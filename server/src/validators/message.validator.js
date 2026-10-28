import { z } from 'zod';

export const createMessageSchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, 'Message body cannot be empty')
    .max(5000, 'Message body cannot exceed 5000 characters'),
  visibility: z.enum(['public', 'internal']).default('public'),
});
