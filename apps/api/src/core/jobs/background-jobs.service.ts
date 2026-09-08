import { OrderStatus, PaymentProvider, PaymentStatus } from '@prisma/client';
import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { prisma } from '../../infrastructure/database/prisma.js';
import { metrics } from '../../infrastructure/observability/metrics.js';
import {
  enqueuePaymentSuccessEmail,
  emailQueueService,
} from '../notifications/email-queue.service.js';
import { transitionOrderStatus } from '../orders/order-status.service.js';
import { getPaymentProvider } from '../payments/payment-provider.registry.js';
import { paymentWebhookService } from '../payments/payment-webhook.service.js';

const executeJob = async (name: string, operation: () => Promise<number>) => {
  await prisma.backgroundJobState.upsert({
    create: { lastStartedAt: new Date(), name },
    update: { lastStartedAt: new Date() },
    where: { name },
  });
  try {
    const processed = await operation();
    await prisma.backgroundJobState.update({
      data: {
        lastError: null,
        lastSucceededAt: new Date(),
        processedCount: { increment: processed },
      },
      where: { name },
    });
    metrics.recordJob(name, 'succeeded', processed);
    return processed;
  } catch (error) {
    const message = (error instanceof Error ? error.message : String(error)).slice(0, 1000);
    await prisma.backgroundJobState.update({
      data: { lastError: message, lastFailedAt: new Date() },
      where: { name },
    });
    metrics.recordJob(name, 'failed', 0);
    logger.error('Background job failed', { error: message, job: name });
    return 0;
  }
};

const reconciliation = async (limit: number, options?: { paymentAttemptId?: string }) => {
  const attempts = await prisma.paymentAttempt.findMany({
    orderBy: { updatedAt: 'asc' },
    select: { id: true, orderId: true, providerPaymentId: true },
    take: limit,
    where: {
      ...(options?.paymentAttemptId ? { id: options.paymentAttemptId } : {}),
      provider: PaymentProvider.SAFEPAY,
      providerPaymentId: { not: null },
      status: { in: [PaymentStatus.PENDING, PaymentStatus.PROCESSING] },
      updatedAt: {
        lte: new Date(Date.now() - env.RECONCILIATION_MIN_AGE_MINUTES * 60_000),
      },
    },
  });
  let processed = 0;
  for (const attempt of attempts) {
    const result = await getPaymentProvider(PaymentProvider.SAFEPAY).verifyPayment({
      providerPaymentId: attempt.providerPaymentId,
    });
    if (result.status === PaymentStatus.PROCESSING || result.status === PaymentStatus.PENDING) {
      continue;
    }
    await prisma.$transaction(async (transaction) => {
      await transaction.$queryRaw`
        SELECT id FROM payment_attempts WHERE id = ${attempt.id} FOR UPDATE
      `;
      const current = await transaction.paymentAttempt.findUnique({
        select: { order: { select: { status: true } }, status: true },
        where: { id: attempt.id },
      });
      if (
        !current ||
        (current.status !== PaymentStatus.PENDING && current.status !== PaymentStatus.PROCESSING)
      ) {
        return;
      }
      await transaction.paymentAttempt.update({
        data: {
          failureReason:
            result.status === PaymentStatus.FAILED
              ? (result.failureReason ?? 'Safepay reconciliation reported failure.')
              : null,
          status: result.status,
        },
        where: { id: attempt.id },
      });
      if (
        result.status === PaymentStatus.SUCCEEDED &&
        current.order.status === OrderStatus.AWAITING_PAYMENT
      ) {
        await transitionOrderStatus({
          actor: { name: 'SAFEPAY_RECONCILIATION', type: 'SYSTEM' },
          nextStatus: OrderStatus.PROCESSING,
          note: `Safepay payment ${attempt.id} confirmed by reconciliation.`,
          orderId: attempt.orderId,
          source: 'PAYMENT',
          transaction,
        });
        await enqueuePaymentSuccessEmail(transaction, attempt.id, attempt.orderId);
      }
    });
    processed += 1;
  }
  return processed;
};

const cleanupExpiredSessions = () => {
  const cutoff = new Date(Date.now() - env.SESSION_RETENTION_DAYS * 24 * 60 * 60_000);
  return prisma.authSession
    .deleteMany({
      where: {
        OR: [{ expiresAt: { lt: cutoff } }, { revokedAt: { lt: cutoff } }],
      },
    })
    .then((result) => result.count);
};

const shouldRun = async (name: string, intervalMs: number) => {
  const state = await prisma.backgroundJobState.findUnique({ where: { name } });
  return !state?.lastStartedAt || state.lastStartedAt < new Date(Date.now() - intervalMs);
};

let running = false;

export const backgroundJobsService = {
  cleanupExpiredSessions,
  reconcilePayments: reconciliation,
  runOnce: async () => {
    if (running) return;
    running = true;
    try {
      await executeJob('email_queue', () => emailQueueService.processBatch(env.WORKER_BATCH_SIZE));
      await executeJob('webhook_retry', () =>
        paymentWebhookService.retryFailed(env.WORKER_BATCH_SIZE),
      );
      if (await shouldRun('payment_reconciliation', 60_000)) {
        await executeJob('payment_reconciliation', () => reconciliation(env.WORKER_BATCH_SIZE));
      }
      if (await shouldRun('session_cleanup', 60 * 60_000)) {
        await executeJob('session_cleanup', cleanupExpiredSessions);
      }
    } finally {
      running = false;
    }
  },
};
