import { ShipmentStatus } from '@prisma/client';
import { z } from 'zod';

export const shipmentIdSchema = z.uuid();

export const shipmentCreateSchema = z.object({
  courier: z.string().trim().min(2).max(120),
  trackingNumber: z.string().trim().min(2).max(191).optional(),
});

export const shipmentUpdateSchema = z
  .object({
    courier: z.string().trim().min(2).max(120).optional(),
    trackingNumber: z.string().trim().min(2).max(191).nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, 'At least one field is required.');

export const shipmentEventCreateSchema = z.object({
  location: z.string().trim().min(2).max(160).optional(),
  message: z.string().trim().min(2).max(500).optional(),
  occurredAt: z.coerce
    .date()
    .max(new Date(Date.now() + 5 * 60_000))
    .optional(),
  status: z.enum(ShipmentStatus),
});

export const adminShipmentListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  q: z.string().trim().max(120).optional(),
  status: z.enum(ShipmentStatus).optional(),
});

export type ShipmentCreateInput = z.infer<typeof shipmentCreateSchema>;
export type ShipmentUpdateInput = z.infer<typeof shipmentUpdateSchema>;
export type ShipmentEventCreateInput = z.infer<typeof shipmentEventCreateSchema>;
export type AdminShipmentListQuery = z.infer<typeof adminShipmentListQuerySchema>;
