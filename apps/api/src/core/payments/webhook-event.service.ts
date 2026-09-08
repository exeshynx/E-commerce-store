import { randomUUID } from 'node:crypto';
import { PaymentWebhookProcessingStatus, type PaymentProvider, type Prisma } from '@prisma/client';
import { prisma } from '../../infrastructure/database/prisma.js';

type WebhookEventInput = {
  eventType: string;
  externalEventId: string;
  payload: Prisma.InputJsonValue;
  provider: PaymentProvider;
  providerCreatedAt?: Date | null;
};

const eventSelect = {
  createdAt: true,
  eventType: true,
  externalEventId: true,
  id: true,
  lastError: true,
  paymentAttemptId: true,
  processedAt: true,
  processingAttempts: true,
  processingStartedAt: true,
  processingStatus: true,
  provider: true,
  providerCreatedAt: true,
  signatureVerified: true,
  updatedAt: true,
} satisfies Prisma.PaymentWebhookEventSelect;

const serializeEvent = (
  event: Prisma.PaymentWebhookEventGetPayload<{ select: typeof eventSelect }>,
) => ({
  ...event,
  createdAt: event.createdAt.toISOString(),
  processedAt: event.processedAt?.toISOString() ?? null,
  processingStartedAt: event.processingStartedAt?.toISOString() ?? null,
  providerCreatedAt: event.providerCreatedAt?.toISOString() ?? null,
  updatedAt: event.updatedAt.toISOString(),
});

const findEvent = (provider: PaymentProvider, externalEventId: string) =>
  prisma.paymentWebhookEvent.findUnique({
    select: eventSelect,
    where: { provider_externalEventId: { externalEventId, provider } },
  });

export const webhookEventService = {
  claim: async (id: string) => {
    const staleBefore = new Date(Date.now() - 5 * 60 * 1000);
    const claimed = await prisma.paymentWebhookEvent.updateMany({
      data: {
        lastError: null,
        processingAttempts: { increment: 1 },
        processingStartedAt: new Date(),
        processingStatus: PaymentWebhookProcessingStatus.PROCESSING,
      },
      where: {
        id,
        OR: [
          {
            processingStatus: {
              in: [PaymentWebhookProcessingStatus.RECEIVED, PaymentWebhookProcessingStatus.FAILED],
            },
          },
          {
            processingStartedAt: { lt: staleBefore },
            processingStatus: PaymentWebhookProcessingStatus.PROCESSING,
          },
        ],
      },
    });
    return claimed.count === 1;
  },

  fail: (id: string, error: unknown) =>
    prisma.paymentWebhookEvent.updateMany({
      data: {
        lastError: (error instanceof Error ? error.message : String(error)).slice(0, 1000),
        processingStartedAt: null,
        processingStatus: PaymentWebhookProcessingStatus.FAILED,
      },
      where: { id, processingStatus: PaymentWebhookProcessingStatus.PROCESSING },
    }),

  record: async (input: WebhookEventInput) => {
    const existing = await findEvent(input.provider, input.externalEventId);
    if (existing) return { created: false, event: serializeEvent(existing) };

    const created = await prisma.$executeRaw`
      INSERT INTO payment_webhook_events (
        id,
        provider,
        external_event_id,
        event_type,
        payload,
        provider_created_at,
        signature_verified,
        created_at,
        updated_at
      ) VALUES (
        ${randomUUID()},
        ${input.provider},
        ${input.externalEventId},
        ${input.eventType},
        ${JSON.stringify(input.payload)},
        ${input.providerCreatedAt ?? null},
        TRUE,
        CURRENT_TIMESTAMP(3),
        CURRENT_TIMESTAMP(3)
      )
      ON DUPLICATE KEY UPDATE id = id
    `;
    const event = await findEvent(input.provider, input.externalEventId);
    if (!event) throw new Error('The verified webhook event could not be stored.');
    return { created: created === 1, event: serializeEvent(event) };
  },
};
