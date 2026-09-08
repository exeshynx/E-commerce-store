import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { PaymentProvider, PaymentRefundStatus, PaymentStatus } from '@prisma/client';
import { env } from '../../config/env.js';
import { AppError } from '../../http/errors/app-error.js';
import type {
  CreatePaymentIntentInput,
  PaymentProviderAdapter,
  RefundPaymentInput,
  VerifiedWebhookEvent,
  VerifyPaymentInput,
  VerifyWebhookInput,
} from './payment-provider.js';
import {
  createSafepayGatewayClient,
  type SafepayEnvironment,
  type SafepayGatewayClient,
} from './safepay.client.js';

type JsonObject = Record<string, unknown>;

export type SafepayProviderConfiguration = {
  client?: SafepayGatewayClient;
  enabled: boolean;
  environment: SafepayEnvironment;
  publicKey?: string;
  secretKey?: string;
  webhookSecret?: string;
};

const asObject = (value: unknown): JsonObject | null =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as JsonObject)
    : null;

const valueAt = (value: unknown, path: readonly string[]) => {
  let current: unknown = value;
  for (const segment of path) {
    const object = asObject(current);
    if (!object) return undefined;
    current = object[segment];
  }
  return current;
};

const firstString = (value: unknown, paths: ReadonlyArray<readonly string[]>) => {
  for (const path of paths) {
    const candidate = valueAt(value, path);
    if (typeof candidate === 'string' && candidate.trim()) return candidate.trim();
  }
  return undefined;
};

const minorUnits = (amount: string) => {
  const match = /^(\d{1,12})(?:\.(\d{1,2}))?$/.exec(amount);
  if (!match) {
    throw new AppError(422, 'INVALID_PAYMENT_AMOUNT', 'The payment amount is invalid.');
  }
  const value = BigInt(match[1] ?? '0') * 100n + BigInt((match[2] ?? '').padEnd(2, '0'));
  if (value <= 0n || value > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new AppError(422, 'INVALID_PAYMENT_AMOUNT', 'The payment amount is invalid.');
  }
  return Number(value);
};

const providerError = (error: unknown): AppError => {
  const object = asObject(error);
  const status = typeof object?.status === 'number' ? object.status : undefined;
  if (status === 401 || status === 403) {
    return new AppError(
      502,
      'PAYMENT_PROVIDER_AUTHENTICATION_FAILED',
      'Safepay rejected the configured API credentials.',
    );
  }
  if (status === 400 || status === 409 || status === 422) {
    return new AppError(
      422,
      'PAYMENT_PROVIDER_REQUEST_REJECTED',
      'Safepay rejected the payment request.',
    );
  }
  const message = error instanceof Error ? error.message.toLowerCase() : '';
  if (message.includes('timeout') || message.includes('network') || message.includes('fetch')) {
    return new AppError(
      503,
      'PAYMENT_PROVIDER_UNAVAILABLE',
      'Safepay is temporarily unavailable. Try again shortly.',
    );
  }
  return new AppError(
    502,
    'PAYMENT_PROVIDER_ERROR',
    'Safepay could not complete the payment operation.',
  );
};

const parseProviderDate = (value: unknown): Date | null => {
  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(
      typeof value === 'number' && value < 10_000_000_000 ? value * 1000 : value,
    );
    return Number.isNaN(date.valueOf()) ? null : date;
  }
  const seconds = valueAt(value, ['seconds']);
  if (typeof seconds === 'number') return new Date(seconds * 1000);
  return null;
};

const decimalFromMinorUnits = (value: unknown): string | null => {
  const digits =
    typeof value === 'number' && Number.isSafeInteger(value)
      ? String(value)
      : typeof value === 'string' && /^\d+$/.test(value)
        ? value
        : null;
  if (!digits) return null;
  const amount = BigInt(digits);
  if (amount <= 0n) return null;
  return `${amount / 100n}.${String(amount % 100n).padStart(2, '0')}`;
};

const extractWebhookStatus = (eventType: string) => {
  const normalized = eventType.toLowerCase().replaceAll(':', '.').replaceAll('_', '.');
  if (normalized === 'payment.succeeded' || normalized === 'payment.success') {
    return { paymentStatus: PaymentStatus.SUCCEEDED, refundStatus: null };
  }
  if (normalized === 'payment.failed' || normalized === 'payment.failure') {
    return { paymentStatus: PaymentStatus.FAILED, refundStatus: null };
  }
  if (normalized === 'payment.cancelled' || normalized === 'payment.canceled') {
    return { paymentStatus: PaymentStatus.CANCELLED, refundStatus: null };
  }
  if (normalized === 'payment.refunded') {
    return { paymentStatus: null, refundStatus: PaymentRefundStatus.SUCCEEDED };
  }
  if (normalized === 'refund.succeeded' || normalized === 'refund.success') {
    return { paymentStatus: null, refundStatus: PaymentRefundStatus.SUCCEEDED };
  }
  if (normalized === 'refund.failed' || normalized === 'refund.failure') {
    return { paymentStatus: null, refundStatus: PaymentRefundStatus.FAILED };
  }
  return { paymentStatus: null, refundStatus: null };
};

const parseWebhook = (rawBody: Buffer, headers: VerifyWebhookInput['headers']) => {
  let payload: unknown;
  try {
    payload = JSON.parse(rawBody.toString('utf8')) as unknown;
  } catch {
    throw new AppError(400, 'INVALID_WEBHOOK_PAYLOAD', 'The webhook payload is not valid JSON.');
  }
  const eventType =
    headers['x-sfpy-event-type'] ??
    firstString(payload, [['type'], ['event_type'], ['event'], ['data', 'type']]);
  if (!eventType) {
    throw new AppError(422, 'INVALID_WEBHOOK_PAYLOAD', 'The webhook event type is missing.');
  }
  const externalEventId =
    headers['x-sfpy-event-id'] ??
    firstString(payload, [['token'], ['event_id'], ['id'], ['data', 'event_id'], ['data', 'id']]) ??
    `body_${createHash('sha256').update(rawBody).digest('hex')}`;
  const providerPaymentId =
    firstString(payload, [
      ['data', 'tracker', 'token'],
      ['tracker', 'token'],
      ['data', 'tracker'],
      ['tracker'],
      ['resource', 'tracker'],
      ['data', 'payment', 'tracker'],
    ]) ?? null;
  const providerRefundId =
    firstString(payload, [
      ['data', 'refund', 'token'],
      ['refund', 'token'],
      ['data', 'refund_id'],
      ['refund_id'],
    ]) ?? null;
  const failureReason = firstString(payload, [
    ['data', 'failure_reason'],
    ['failure_reason'],
    ['data', 'message'],
    ['message'],
    ['data', 'reason'],
    ['reason'],
  ]);
  const providerCreatedAt = parseProviderDate(
    valueAt(payload, ['created_at']) ?? valueAt(payload, ['data', 'created_at']),
  );
  const refundAmount = decimalFromMinorUnits(
    valueAt(payload, ['data', 'refund_amount']) ?? valueAt(payload, ['refund_amount']),
  );
  const rawRefundCurrency = firstString(payload, [
    ['data', 'currency'],
    ['currency'],
  ])?.toUpperCase();
  const refundCurrency =
    rawRefundCurrency && /^[A-Z]{3}$/.test(rawRefundCurrency) ? rawRefundCurrency : null;
  return {
    eventType,
    externalEventId: externalEventId.slice(0, 191),
    ...(failureReason ? { failureReason: failureReason.slice(0, 500) } : {}),
    payload,
    providerCreatedAt,
    providerPaymentId,
    providerRefundId,
    refundAmount,
    refundCurrency,
    ...extractWebhookStatus(eventType),
  } satisfies VerifiedWebhookEvent;
};

export const parseStoredSafepayWebhook = (payload: unknown) =>
  parseWebhook(Buffer.from(JSON.stringify(payload)), {});

const assertConfigured = (configuration: SafepayProviderConfiguration) => {
  if (
    !configuration.enabled ||
    !configuration.publicKey ||
    !configuration.secretKey ||
    !configuration.webhookSecret
  ) {
    throw new AppError(
      503,
      'PAYMENT_PROVIDER_NOT_CONFIGURED',
      'Safepay payments are not configured.',
    );
  }
};

export const createSafepayPaymentProvider = (
  configuration: SafepayProviderConfiguration,
): PaymentProviderAdapter => {
  const gatewayClient = () => {
    assertConfigured(configuration);
    return (
      configuration.client ??
      createSafepayGatewayClient({
        environment: configuration.environment,
        secretKey: configuration.secretKey as string,
      })
    );
  };

  return {
    provider: PaymentProvider.SAFEPAY,

    createPaymentIntent: async (input: CreatePaymentIntentInput) => {
      if (input.currency !== 'PKR') {
        throw new AppError(
          422,
          'PAYMENT_CURRENCY_UNSUPPORTED',
          'Safepay checkout currently supports PKR orders only.',
        );
      }
      try {
        const client = gatewayClient();
        const trackerResponse = await client.createTracker({
          amount: minorUnits(input.amount),
          currency: input.currency,
          idempotencyKey: input.idempotencyKey,
          orderId: input.orderId,
          paymentAttemptId: input.attemptId,
          publicKey: configuration.publicKey as string,
        });
        const tracker = firstString(trackerResponse, [
          ['data', 'tracker', 'token'],
          ['tracker', 'token'],
          ['data', 'token'],
          ['token'],
        ]);
        if (!tracker) throw new Error('Safepay tracker response did not include a token.');

        const passportResponse = await client.createPassportToken();
        const passportToken = firstString(passportResponse, [
          ['data'],
          ['data', 'token'],
          ['token'],
        ]);
        if (!passportToken) throw new Error('Safepay passport response did not include a token.');

        return {
          checkoutUrl: client.createCheckoutUrl({
            cancelUrl: input.cancelUrl,
            environment: configuration.environment,
            orderId: input.orderId,
            passportToken,
            returnUrl: input.returnUrl,
            tracker,
          }),
          metadata: {
            environment: configuration.environment,
            intent: 'CYBERSOURCE',
            mode: 'hosted',
          },
          providerPaymentId: tracker,
          status: PaymentStatus.PENDING,
        };
      } catch (error) {
        if (error instanceof AppError) throw error;
        throw providerError(error);
      }
    },

    verifyPayment: async (input: VerifyPaymentInput) => {
      if (!input.providerPaymentId) {
        return { failureReason: 'The Safepay tracker is missing.', status: PaymentStatus.FAILED };
      }
      try {
        const response = await gatewayClient().fetchPayment(input.providerPaymentId);
        const state = firstString(response, [
          ['data', 'tracker', 'state'],
          ['data', 'state'],
          ['state'],
        ]);
        const isSuccess =
          valueAt(response, ['data', 'tracker', 'is_success']) ??
          valueAt(response, ['data', 'is_success']);
        if (state === 'TRACKER_ENDED' && isSuccess !== false) {
          return { status: PaymentStatus.SUCCEEDED };
        }
        if (isSuccess === false) {
          return {
            failureReason: 'Safepay reported a failed payment.',
            status: PaymentStatus.FAILED,
          };
        }
        return { status: PaymentStatus.PROCESSING };
      } catch (error) {
        if (error instanceof AppError) throw error;
        throw providerError(error);
      }
    },

    verifyWebhook: ({ headers, rawBody }: VerifyWebhookInput) => {
      assertConfigured(configuration);
      const supplied = (headers['x-sfpy-signature'] ?? '').replace(/^sha512=/i, '').toLowerCase();
      const expected = createHmac('sha512', configuration.webhookSecret as string)
        .update(rawBody)
        .digest('hex');
      const suppliedBuffer = Buffer.from(supplied, 'hex');
      const expectedBuffer = Buffer.from(expected, 'hex');
      if (
        !/^[a-f\d]{128}$/.test(supplied) ||
        suppliedBuffer.length !== expectedBuffer.length ||
        !timingSafeEqual(suppliedBuffer, expectedBuffer)
      ) {
        throw new AppError(
          401,
          'INVALID_WEBHOOK_SIGNATURE',
          'The Safepay webhook signature is invalid.',
        );
      }
      return Promise.resolve(parseWebhook(rawBody, headers));
    },

    refundPayment: async (input: RefundPaymentInput) => {
      if (input.currency !== 'PKR') {
        throw new AppError(
          422,
          'PAYMENT_CURRENCY_UNSUPPORTED',
          'Safepay refunds currently support PKR payments only.',
        );
      }
      try {
        const response = await gatewayClient().refundPayment(input.providerPaymentId, {
          amount: minorUnits(input.amount),
          currency: input.currency,
          idempotencyKey: input.idempotencyKey,
          ...(input.reason ? { reason: input.reason } : {}),
        });
        const providerRefundId =
          firstString(response, [
            ['data', 'refund', 'token'],
            ['refund', 'token'],
            ['data', 'token'],
            ['token'],
          ]) ?? null;
        const successful =
          valueAt(response, ['ok']) === true ||
          firstString(response, [['status', 'message'], ['message']])?.toLowerCase() === 'success';
        return {
          metadata: { environment: configuration.environment },
          providerRefundId,
          status: successful ? PaymentRefundStatus.SUCCEEDED : PaymentRefundStatus.PROCESSING,
        };
      } catch (error) {
        if (error instanceof AppError) throw error;
        throw providerError(error);
      }
    },
  };
};

export const safepayPaymentProvider = createSafepayPaymentProvider({
  enabled: env.SAFEPAY_ENABLED,
  environment: env.SAFEPAY_ENVIRONMENT,
  ...(env.SAFEPAY_PUBLIC_KEY ? { publicKey: env.SAFEPAY_PUBLIC_KEY } : {}),
  ...(env.SAFEPAY_SECRET_KEY ? { secretKey: env.SAFEPAY_SECRET_KEY } : {}),
  ...(env.SAFEPAY_WEBHOOK_SECRET ? { webhookSecret: env.SAFEPAY_WEBHOOK_SECRET } : {}),
});
