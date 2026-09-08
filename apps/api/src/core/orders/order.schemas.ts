import { z } from 'zod';
import { couponCodeSchema } from '../promotions/coupon.schemas.js';

const requiredText = (maximum: number) => z.string().trim().min(1).max(maximum);

export const shippingAddressSchema = z.object({
  address: requiredText(1_000).min(5),
  city: requiredText(100),
  country: requiredText(100),
  email: z.email().transform((email) => email.trim().toLowerCase()),
  fullName: requiredText(160).min(2),
  phone: z
    .string()
    .trim()
    .min(7)
    .max(32)
    .regex(/^\+?[0-9][0-9\s()-]*$/, 'Enter a valid phone number'),
  postalCode: requiredText(20).min(2),
  province: requiredText(100),
});

export const checkoutSchema = z
  .object({
    addressId: z.uuid().optional(),
    couponCode: couponCodeSchema.optional(),
    shippingAddress: shippingAddressSchema.optional(),
  })
  .refine((input) => Boolean(input.addressId) !== Boolean(input.shippingAddress), {
    message: 'Provide either a saved address or shipping address details',
    path: ['shippingAddress'],
  });

export const idempotencyKeySchema = z
  .string()
  .trim()
  .min(16)
  .max(128)
  .regex(/^[A-Za-z0-9._:-]+$/, 'Use letters, numbers, periods, underscores, colons, or hyphens');

export const orderIdSchema = z.uuid();

export const orderListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(10),
});

export type CheckoutInput = z.infer<typeof checkoutSchema>;
export type OrderListQuery = z.infer<typeof orderListQuerySchema>;
