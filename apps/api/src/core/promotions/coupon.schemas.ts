import { CouponType } from '@prisma/client';
import { z } from 'zod';

export const couponCodeSchema = z
  .string()
  .trim()
  .min(3)
  .max(64)
  .transform((code) => code.toUpperCase())
  .refine((code) => /^[A-Z0-9][A-Z0-9_-]*$/.test(code), {
    message: 'Coupon codes may contain letters, numbers, hyphens, and underscores',
  });

const optionalDate = z.coerce.date().nullable().optional();
const optionalMoney = z.coerce.number().nonnegative().max(9_999_999_999.99).nullable().optional();
const optionalLimit = z.coerce.number().int().positive().max(2_147_483_647).nullable().optional();
const currency = z
  .string()
  .trim()
  .length(3)
  .transform((value) => value.toUpperCase())
  .refine((value) => /^[A-Z]{3}$/.test(value), 'Use a three-letter ISO 4217 code');

const couponShape = {
  code: couponCodeSchema,
  currency: currency.default('PKR'),
  description: z.string().trim().max(500).nullable().optional(),
  expiresAt: optionalDate,
  isEnabled: z.boolean().default(true),
  maximumUses: optionalLimit,
  maximumUsesPerCustomer: optionalLimit,
  minimumOrderValue: optionalMoney,
  startsAt: optionalDate,
  type: z.nativeEnum(CouponType),
  value: z.coerce.number().positive().max(9_999_999_999.99),
};

const validDefinition = (input: {
  expiresAt?: Date | null | undefined;
  startsAt?: Date | null | undefined;
  type?: CouponType | undefined;
  value?: number | undefined;
}) =>
  (!input.startsAt || !input.expiresAt || input.expiresAt > input.startsAt) &&
  (input.type !== CouponType.PERCENTAGE || input.value === undefined || input.value <= 100);

export const couponCreateSchema = z
  .object(couponShape)
  .refine(validDefinition, 'Expiry must follow the start date and percentage must not exceed 100');

export const couponUpdateSchema = z
  .object(couponShape)
  .partial()
  .refine((input) => Object.keys(input).length > 0, 'Provide at least one field to update')
  .refine(validDefinition, 'Expiry must follow the start date and percentage must not exceed 100');

export const couponPreviewSchema = z.object({ code: couponCodeSchema });

export const adminCouponListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().trim().min(1).max(100).optional(),
  status: z.enum(['all', 'enabled', 'disabled', 'active', 'expired', 'scheduled']).default('all'),
});

export const couponIdSchema = z.uuid();

export type CouponCreateInput = z.infer<typeof couponCreateSchema>;
export type CouponUpdateInput = z.infer<typeof couponUpdateSchema>;
export type AdminCouponListQuery = z.infer<typeof adminCouponListQuerySchema>;
