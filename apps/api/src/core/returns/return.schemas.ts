import { ReturnReason, ReturnShipmentStatus, ReturnStatus } from '@prisma/client';
import { z } from 'zod';

const paginationShape = {
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(10),
};

export const returnIdSchema = z.uuid();

export const returnCreateSchema = z
  .object({
    customerNote: z.string().trim().min(2).max(1000).optional(),
    items: z
      .array(
        z
          .object({
            orderItemId: z.uuid(),
            quantity: z.coerce.number().int().min(1).max(10_000),
            reason: z.enum(ReturnReason),
            reasonDetails: z.string().trim().min(2).max(500).optional(),
          })
          .strict(),
      )
      .min(1)
      .max(50),
    orderId: z.uuid(),
  })
  .strict()
  .superRefine((value, context) => {
    const ids = value.items.map((item) => item.orderItemId);
    if (new Set(ids).size !== ids.length) {
      context.addIssue({
        code: 'custom',
        message: 'Each order item may appear only once.',
        path: ['items'],
      });
    }
  });

export const returnListQuerySchema = z.object({ ...paginationShape });

export const adminReturnListQuerySchema = z.object({
  ...paginationShape,
  q: z.string().trim().max(120).optional(),
  status: z.enum(ReturnStatus).optional(),
});

const optionalNote = z.string().trim().min(2).max(500).optional();

export const adminReturnUpdateSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('APPROVE'), note: optionalNote }).strict(),
  z.object({ action: z.literal('REJECT'), reason: z.string().trim().min(2).max(500) }).strict(),
  z.object({ action: z.literal('RECEIVE_ITEM'), note: optionalNote }).strict(),
  z
    .object({ action: z.literal('INSPECT'), inspectionNotes: z.string().trim().min(2).max(2000) })
    .strict(),
  z
    .object({
      action: z.literal('INITIATE_REFUND'),
      amount: z
        .string()
        .trim()
        .regex(/^\d{1,12}(?:\.\d{1,2})?$/, 'Enter a positive amount with up to two decimals')
        .refine((value) => Number(value) > 0, 'Refund amount must be greater than zero'),
      idempotencyKey: z
        .string()
        .trim()
        .min(16)
        .max(128)
        .regex(/^[A-Za-z0-9._:-]+$/),
      paymentAttemptId: z.uuid(),
      reason: optionalNote,
    })
    .strict(),
  z.object({ action: z.literal('CLOSE'), note: optionalNote }).strict(),
  z
    .object({
      action: z.literal('UPDATE_SHIPMENT'),
      courier: z.string().trim().min(2).max(120).nullable().optional(),
      trackingNumber: z.string().trim().min(2).max(191).nullable().optional(),
    })
    .strict()
    .refine(
      (value) => value.courier !== undefined || value.trackingNumber !== undefined,
      'Courier or tracking number is required.',
    ),
  z
    .object({
      action: z.literal('ADD_SHIPMENT_EVENT'),
      location: z.string().trim().min(2).max(160).optional(),
      message: z.string().trim().min(2).max(500).optional(),
      occurredAt: z.coerce
        .date()
        .max(new Date(Date.now() + 5 * 60_000))
        .optional(),
      status: z.enum(ReturnShipmentStatus),
    })
    .strict(),
]);

export type ReturnCreateInput = z.infer<typeof returnCreateSchema>;
export type ReturnListQuery = z.infer<typeof returnListQuerySchema>;
export type AdminReturnListQuery = z.infer<typeof adminReturnListQuerySchema>;
export type AdminReturnUpdateInput = z.infer<typeof adminReturnUpdateSchema>;
