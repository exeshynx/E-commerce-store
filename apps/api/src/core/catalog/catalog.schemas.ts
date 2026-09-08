import { z } from 'zod';

const slugSchema = z
  .string()
  .trim()
  .min(1)
  .max(200)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase letters, numbers, and hyphens');

const optionalDescriptionSchema = z.string().trim().max(10_000).nullable().optional();
const currencySchema = z
  .string()
  .trim()
  .length(3)
  .transform((currency) => currency.toUpperCase())
  .refine((currency) => /^[A-Z]{3}$/.test(currency), 'Use a three-letter ISO 4217 code');

export const categoryCreateSchema = z.object({
  description: optionalDescriptionSchema,
  isActive: z.boolean().default(true),
  name: z.string().trim().min(2).max(120),
  slug: slugSchema.max(140).optional(),
});

export const categoryUpdateSchema = categoryCreateSchema
  .partial()
  .refine((input) => Object.keys(input).length > 0, 'Provide at least one field to update');

export const productCreateSchema = z.object({
  availableQuantity: z.coerce.number().int().min(0).default(0),
  categoryId: z.uuid(),
  currency: currencySchema.default('PKR'),
  description: z.string().trim().min(1).max(50_000),
  isActive: z.boolean().default(true),
  isFeatured: z.boolean().default(false),
  name: z.string().trim().min(2).max(180),
  price: z.coerce.number().positive().max(9_999_999_999.99),
  sku: z
    .string()
    .trim()
    .min(1)
    .max(64)
    .transform((sku) => sku.toUpperCase())
    .refine((sku) => /^[A-Z0-9][A-Z0-9_-]*$/.test(sku), {
      message: 'SKU may contain uppercase letters, numbers, hyphens, and underscores',
    }),
  slug: slugSchema.optional(),
});

export const productUpdateSchema = productCreateSchema
  .partial()
  .refine((input) => Object.keys(input).length > 0, 'Provide at least one field to update');

export const productListQuerySchema = z.object({
  category: slugSchema.max(140).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(12),
  q: z.string().trim().min(1).max(100).optional(),
});

export const catalogIdSchema = z.uuid();
export const productIdentifierSchema = z.string().trim().min(1).max(200);

export const imageMetadataSchema = z.object({
  altText: z.string().trim().max(160).nullable().optional(),
});

export const imageUpdateSchema = z
  .object({
    altText: z.string().trim().max(160).nullable().optional(),
    position: z.coerce.number().int().min(0).optional(),
  })
  .refine((input) => Object.keys(input).length > 0, 'Provide at least one field to update');

export type CategoryCreateInput = z.infer<typeof categoryCreateSchema>;
export type CategoryUpdateInput = z.infer<typeof categoryUpdateSchema>;
export type ImageUpdateInput = z.infer<typeof imageUpdateSchema>;
export type ProductCreateInput = z.infer<typeof productCreateSchema>;
export type ProductListQuery = z.infer<typeof productListQuerySchema>;
export type ProductUpdateInput = z.infer<typeof productUpdateSchema>;

export const createSlug = (value: string) =>
  value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
