import {
  OrderStatus,
  PaymentProvider,
  PaymentRefundStatus,
  PaymentStatus,
  PaymentWebhookProcessingStatus,
  Prisma,
} from '@prisma/client';
import { createHash } from 'node:crypto';
import { AppError } from '../../http/errors/app-error.js';
import { prisma } from '../../infrastructure/database/prisma.js';
import { transitionOrderStatus } from '../orders/order-status.service.js';
import { enqueuePaymentSuccessEmail } from '../notifications/email-queue.service.js';
import { getPaymentProvider } from './payment-provider.registry.js';
import type { VerifiedWebhookEvent } from './payment-provider.js';
import { webhookEventService } from './webhook-event.service.js';
import { parseStoredSafepayWebhook } from './safepay-payment.provider.js';
import { synchronizeReturnRefundStatus } from '../returns/return-refund.service.js';

const jsonPayload = (value: unknown): Prisma.InputJsonValue => value as Prisma.InputJsonValue;

const processPaymentEvent = async (
  transaction: Prisma.TransactionClient,
  event: VerifiedWebhookEvent,
  webhookEventId: string,
) => {
  if (!event.providerPaymentId || !event.paymentStatus) return null;
  const payment = await transaction.paymentAttempt.findFirst({
    select: { id: true, orderId: true, status: true },
    where: {
      provider: PaymentProvider.SAFEPAY,
      providerPaymentId: event.providerPaymentId,
    },
  });
  if (!payment) return null;

  if (event.paymentStatus === PaymentStatus.SUCCEEDED) {
    if (payment.status !== PaymentStatus.SUCCEEDED) {
      const updated = await transaction.paymentAttempt.updateMany({
        data: { failureReason: null, status: PaymentStatus.SUCCEEDED },
        where: {
          id: payment.id,
          status: {
            in: [PaymentStatus.PENDING, PaymentStatus.PROCESSING, PaymentStatus.FAILED],
          },
        },
      });
      if (updated.count !== 1) {
        throw new AppError(
          409,
          'PAYMENT_STATUS_CONFLICT',
          'The payment status changed while processing the webhook.',
        );
      }
      const order = await transaction.order.findUnique({
        select: { status: true },
        where: { id: payment.orderId },
      });
      if (order?.status === OrderStatus.AWAITING_PAYMENT) {
        await transitionOrderStatus({
          actor: { name: 'SAFEPAY_WEBHOOK', type: 'SYSTEM' },
          nextStatus: OrderStatus.PROCESSING,
          note: `Safepay payment ${payment.id} confirmed by event ${event.externalEventId}.`,
          orderId: payment.orderId,
          source: 'PAYMENT',
          transaction,
        });
        await enqueuePaymentSuccessEmail(transaction, payment.id, payment.orderId);
      }
    }
  } else if (
    event.paymentStatus === PaymentStatus.FAILED ||
    event.paymentStatus === PaymentStatus.CANCELLED
  ) {
    await transaction.paymentAttempt.updateMany({
      data: {
        failureReason:
          event.failureReason ??
          (event.paymentStatus === PaymentStatus.CANCELLED
            ? 'The payment was cancelled.'
            : 'Safepay reported a failed payment.'),
        status: event.paymentStatus,
      },
      where: {
        id: payment.id,
        status: { in: [PaymentStatus.PENDING, PaymentStatus.PROCESSING] },
      },
    });
  }

  await transaction.paymentWebhookEvent.update({
    data: { paymentAttemptId: payment.id },
    where: { id: webhookEventId },
  });
  return payment.id;
};

const processRefundEvent = async (
  transaction: Prisma.TransactionClient,
  event: VerifiedWebhookEvent,
  webhookEventId: string,
) => {
  if (!event.refundStatus) return null;
  let refund = event.providerRefundId
    ? await transaction.paymentRefund.findFirst({
        select: { id: true, paymentAttemptId: true, returnRequestId: true },
        where: { providerRefundId: event.providerRefundId },
      })
    : null;
  let paymentAttemptId: string | null = refund?.paymentAttemptId ?? null;

  if (!refund && event.providerPaymentId) {
    const payment = await transaction.paymentAttempt.findFirst({
      select: { id: true },
      where: {
        provider: PaymentProvider.SAFEPAY,
        providerPaymentId: event.providerPaymentId,
      },
    });
    paymentAttemptId = payment?.id ?? null;
    if (payment && event.refundAmount && event.refundCurrency) {
      const amountAndCurrency = {
        amount: event.refundAmount,
        currency: event.refundCurrency,
        paymentAttemptId: payment.id,
      };
      refund =
        (await transaction.paymentRefund.findFirst({
          orderBy: { createdAt: 'asc' },
          select: { id: true, paymentAttemptId: true, returnRequestId: true },
          where: {
            ...amountAndCurrency,
            status: { in: [PaymentRefundStatus.PENDING, PaymentRefundStatus.PROCESSING] },
          },
        })) ??
        (await transaction.paymentRefund.findFirst({
          orderBy: { createdAt: 'desc' },
          select: { id: true, paymentAttemptId: true, returnRequestId: true },
          where: { ...amountAndCurrency, status: PaymentRefundStatus.SUCCEEDED },
        }));

      if (!refund && event.refundStatus === PaymentRefundStatus.SUCCEEDED) {
        refund = await transaction.paymentRefund.create({
          data: {
            amount: new Prisma.Decimal(event.refundAmount),
            currency: event.refundCurrency,
            metadata: { eventType: event.eventType, source: 'SAFEPAY_WEBHOOK' },
            paymentAttemptId: payment.id,
            providerIdempotencyKey: `webhook_${createHash('sha256')
              .update(event.externalEventId)
              .digest('hex')}`,
            providerRefundId: event.providerRefundId,
            reason: 'Recorded from a verified Safepay webhook.',
            status: PaymentRefundStatus.SUCCEEDED,
          },
          select: { id: true, paymentAttemptId: true, returnRequestId: true },
        });
      }
    }
  }

  if (!refund) {
    if (paymentAttemptId) {
      await transaction.paymentWebhookEvent.update({
        data: { paymentAttemptId },
        where: { id: webhookEventId },
      });
    }
    return null;
  }
  await transaction.paymentRefund.updateMany({
    data: {
      failureReason:
        event.refundStatus === PaymentRefundStatus.FAILED
          ? (event.failureReason ?? 'Safepay reported a failed refund.')
          : null,
      status: event.refundStatus,
    },
    where: {
      id: refund.id,
      status: {
        in: [
          PaymentRefundStatus.PENDING,
          PaymentRefundStatus.PROCESSING,
          PaymentRefundStatus.FAILED,
        ],
      },
    },
  });
  await synchronizeReturnRefundStatus(transaction, refund.returnRequestId);
  await transaction.paymentWebhookEvent.update({
    data: { paymentAttemptId: refund.paymentAttemptId },
    where: { id: webhookEventId },
  });
  return refund.paymentAttemptId;
};

const processVerifiedEvent = async (
  eventId: string,
  verified: VerifiedWebhookEvent,
  duplicate: boolean,
) => {
  const claimed = await webhookEventService.claim(eventId);
  if (!claimed) {
    return {
      duplicate: true,
      eventId,
      status: PaymentWebhookProcessingStatus.PROCESSING,
    };
  }

  try {
    const status = await prisma.$transaction(async (transaction) => {
      const paymentAttemptId =
        (await processPaymentEvent(transaction, verified, eventId)) ??
        (await processRefundEvent(transaction, verified, eventId));
      const processingStatus = paymentAttemptId
        ? PaymentWebhookProcessingStatus.PROCESSED
        : PaymentWebhookProcessingStatus.IGNORED;
      await transaction.paymentWebhookEvent.update({
        data: {
          lastError: null,
          processedAt: new Date(),
          processingStartedAt: null,
          processingStatus,
        },
        where: { id: eventId },
      });
      return processingStatus;
    });
    return { duplicate, eventId, status };
  } catch (error) {
    await webhookEventService.fail(eventId, error);
    throw new AppError(
      500,
      'WEBHOOK_PROCESSING_FAILED',
      'The verified webhook could not be processed and can be retried.',
    );
  }
};

export const paymentWebhookService = {
  handleSafepay: async (rawBody: Buffer, headers: Record<string, string | undefined>) => {
    const verified = await getPaymentProvider(PaymentProvider.SAFEPAY).verifyWebhook({
      headers,
      rawBody,
    });
    const received = await webhookEventService.record({
      eventType: verified.eventType,
      externalEventId: verified.externalEventId,
      payload: jsonPayload(verified.payload),
      provider: PaymentProvider.SAFEPAY,
      providerCreatedAt: verified.providerCreatedAt,
    });

    if (
      received.event.processingStatus === PaymentWebhookProcessingStatus.PROCESSED ||
      received.event.processingStatus === PaymentWebhookProcessingStatus.IGNORED
    ) {
      return {
        duplicate: true,
        eventId: received.event.id,
        status: received.event.processingStatus,
      };
    }
    return processVerifiedEvent(received.event.id, verified, !received.created);
  },

  retryFailed: async (limit: number, options?: { paymentAttemptId?: string }) => {
    const events = await prisma.paymentWebhookEvent.findMany({
      orderBy: { updatedAt: 'asc' },
      select: { id: true, payload: true },
      take: limit,
      where: {
        processingStatus: PaymentWebhookProcessingStatus.FAILED,
        provider: PaymentProvider.SAFEPAY,
        ...(options?.paymentAttemptId ? { paymentAttemptId: options.paymentAttemptId } : {}),
      },
    });
    let processed = 0;
    for (const event of events) {
      try {
        await processVerifiedEvent(event.id, parseStoredSafepayWebhook(event.payload), true);
        processed += 1;
      } catch {
        // The event remains FAILED with its latest error for a later retry.
      }
    }
    return processed;
  },
};
