import { randomUUID } from 'node:crypto';
import { PaymentProvider, PaymentRefundStatus, PaymentStatus } from '@prisma/client';
import type {
  CreatePaymentIntentInput,
  PaymentProviderAdapter,
  RefundPaymentInput,
  VerifyPaymentInput,
  VerifyWebhookInput,
} from './payment-provider.js';

export const manualPaymentProvider: PaymentProviderAdapter = {
  provider: PaymentProvider.MANUAL,

  createPaymentIntent: (_input: CreatePaymentIntentInput) =>
    Promise.resolve({
      checkoutUrl: null,
      metadata: { mode: 'development_manual' },
      providerPaymentId: `manual_${randomUUID()}`,
      status: PaymentStatus.PENDING,
    }),

  verifyPayment: (_input: VerifyPaymentInput) => Promise.resolve({ status: PaymentStatus.PENDING }),

  verifyWebhook: (_input: VerifyWebhookInput) =>
    Promise.reject(new Error('The manual payment provider does not receive webhooks.')),

  refundPayment: (_input: RefundPaymentInput) =>
    Promise.resolve({
      metadata: { mode: 'development_manual' },
      providerRefundId: `manual_refund_${randomUUID()}`,
      status: PaymentRefundStatus.SUCCEEDED,
    }),
};
