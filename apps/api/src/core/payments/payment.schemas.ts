import { PaymentProvider, PaymentStatus } from '@prisma/client';
import { z } from 'zod';

export const paymentAttemptIdSchema = z.uuid();

export const paymentRefundSchema = z
  .object({
    amount: z
      .string()
      .trim()
      .regex(/^\d{1,12}(?:\.\d{1,2})?$/, 'Enter a positive amount with up to two decimals')
      .refine((value) => Number(value) > 0, 'Refund amount must be greater than zero'),
    reason: z.string().trim().min(2).max(500).optional(),
  })
  .strict();

export const adminPaymentListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
  provider: z.enum(PaymentProvider).optional(),
  q: z.string().trim().max(120).optional(),
  status: z.enum(PaymentStatus).optional(),
});

export const manualPaymentStatusUpdateSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal(PaymentStatus.SUCCEEDED) }).strict(),
  z
    .object({
      failureReason: z.string().trim().min(1).max(500),
      status: z.literal(PaymentStatus.FAILED),
    })
    .strict(),
]);

export const webhookEventInputSchema = z.object({
  eventType: z.string().trim().min(1).max(191),
  externalEventId: z.string().trim().min(1).max(191),
  payload: z.unknown(),
  provider: z.enum(PaymentProvider),
});

export type AdminPaymentListQuery = z.infer<typeof adminPaymentListQuerySchema>;
export type ManualPaymentStatusUpdateInput = z.infer<typeof manualPaymentStatusUpdateSchema>;
export type PaymentRefundInput = z.infer<typeof paymentRefundSchema>;
export type WebhookEventInput = z.infer<typeof webhookEventInputSchema>;
