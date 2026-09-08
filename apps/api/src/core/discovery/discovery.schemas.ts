import { z } from 'zod';

export const searchQuerySchema = z
  .object({
    availability: z.enum(['all', 'in_stock', 'out_of_stock']).default('all'),
    category: z
      .string()
      .trim()
      .max(140)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
      .optional(),
    maximumPrice: z.coerce.number().nonnegative().max(9_999_999_999.99).optional(),
    minimumPrice: z.coerce.number().nonnegative().max(9_999_999_999.99).optional(),
    minimumRating: z.coerce.number().min(1).max(5).optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(12),
    q: z.string().trim().min(1).max(100).optional(),
    sort: z
      .enum(['relevance', 'newest', 'best_selling', 'highest_rated', 'price_low', 'price_high'])
      .default('relevance'),
  })
  .refine(
    (input) =>
      input.minimumPrice === undefined ||
      input.maximumPrice === undefined ||
      input.minimumPrice <= input.maximumPrice,
    { message: 'Minimum price cannot exceed maximum price', path: ['maximumPrice'] },
  );

export const autocompleteQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(10).default(6),
  q: z.string().trim().min(2).max(100),
});

export const recommendationQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(20).default(8),
  productId: z.uuid().optional(),
  type: z
    .enum(['related', 'recently_viewed', 'featured', 'newest', 'best_sellers', 'trending'])
    .default('featured'),
});

export const productViewSchema = z.object({ productId: z.uuid() });

export type SearchQuery = z.infer<typeof searchQuerySchema>;
export type RecommendationQuery = z.infer<typeof recommendationQuerySchema>;
