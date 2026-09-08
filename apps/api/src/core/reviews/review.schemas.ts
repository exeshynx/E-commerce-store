import { ReviewStatus } from '@prisma/client';
import { z } from 'zod';

const reviewContent = {
  body: z.string().trim().min(10).max(5_000),
  rating: z.coerce.number().int().min(1).max(5),
  title: z.string().trim().min(2).max(120).nullable().optional(),
};

export const reviewCreateSchema = z.object(reviewContent);

export const reviewUpdateSchema = z
  .object(reviewContent)
  .partial()
  .refine((input) => Object.keys(input).length > 0, 'Provide at least one field to update');

export const reviewListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(10),
  sort: z.enum(['newest', 'highest', 'lowest']).default('newest'),
});

export const adminReviewListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().trim().min(1).max(100).optional(),
  status: z.nativeEnum(ReviewStatus).optional(),
  visibility: z.enum(['all', 'visible', 'deleted']).default('all'),
});

export const adminReviewUpdateSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('approve'), note: z.string().trim().min(1).max(500).optional() }),
  z.object({ action: z.literal('reject'), note: z.string().trim().min(1).max(500) }),
  z.object({ action: z.literal('delete'), note: z.string().trim().min(1).max(500).optional() }),
  z.object({ action: z.literal('restore'), note: z.string().trim().min(1).max(500).optional() }),
]);

export const reviewIdSchema = z.uuid();

export type ReviewCreateInput = z.infer<typeof reviewCreateSchema>;
export type ReviewUpdateInput = z.infer<typeof reviewUpdateSchema>;
export type ReviewListQuery = z.infer<typeof reviewListQuerySchema>;
export type AdminReviewListQuery = z.infer<typeof adminReviewListQuerySchema>;
export type AdminReviewUpdateInput = z.infer<typeof adminReviewUpdateSchema>;
