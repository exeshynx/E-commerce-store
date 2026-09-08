import { z } from 'zod';
import { passwordSchema } from '../auth/auth.schemas.js';
import { shippingAddressSchema } from '../orders/order.schemas.js';

export const addressCreateSchema = shippingAddressSchema.extend({
  isDefaultBilling: z.boolean().default(false),
  isDefaultShipping: z.boolean().default(false),
  label: z.string().trim().min(1).max(80),
});

export const addressUpdateSchema = addressCreateSchema
  .partial()
  .refine((input) => Object.keys(input).length > 0, 'Provide at least one field to update');

export const addressIdSchema = z.uuid();

export const profileUpdateSchema = z
  .object({
    avatarAltText: z.string().trim().max(160).nullable().optional(),
    avatarUrl: z.url().max(500).nullable().optional(),
    firstName: z.string().trim().min(1).max(80).optional(),
    lastName: z.string().trim().min(1).max(80).optional(),
    phone: z
      .string()
      .trim()
      .min(7)
      .max(32)
      .regex(/^\+?[0-9][0-9\s()-]*$/, 'Enter a valid phone number')
      .nullable()
      .optional(),
  })
  .refine((input) => Object.keys(input).length > 0, 'Provide at least one field to update');

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1).max(128),
    newPassword: passwordSchema,
  })
  .refine((input) => input.currentPassword !== input.newPassword, {
    message: 'The new password must be different',
    path: ['newPassword'],
  });

export type AddressCreateInput = z.infer<typeof addressCreateSchema>;
export type AddressUpdateInput = z.infer<typeof addressUpdateSchema>;
export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
