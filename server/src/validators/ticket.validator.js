import { z } from 'zod';
import { ALLOWED_CATEGORIES } from '../services/ai.service.js';

export const createTicketSchema = z.object({
  subject: z
    .string()
    .trim()
    .min(3, 'Subject must be at least 3 characters')
    .max(200, 'Subject cannot exceed 200 characters'),
  description: z
    .string()
    .trim()
    .min(10, 'Description must be at least 10 characters')
    .max(5000, 'Description cannot exceed 5000 characters'),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium').optional(),
  category: z.string().trim().optional(),
});

export const updateTicketSchema = z.object({
  status: z.enum(['open', 'in_progress', 'waiting_customer', 'resolved']).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  category: z
    .string()
    .refine((val) => ALLOWED_CATEGORIES.includes(val), {
      message: `Category must be one of: ${ALLOWED_CATEGORIES.join(', ')}`,
    })
    .optional(),
  assigned_agent_id: z.number().int().positive().nullable().optional(),
});
