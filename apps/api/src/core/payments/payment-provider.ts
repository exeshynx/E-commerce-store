import type { PaymentProvider, PaymentRefundStatus, PaymentStatus } from '@prisma/client';

export type CreatePaymentIntentInput = {
  amount: string;
  attemptId: string;
  customer: {
    email: string;
    firstName: string;
    lastName: string;
    phone: string;
  };
  currency: string;
  idempotencyKey: string;
  orderId: string;
  orderNumber: string;
  returnUrl: string;
  cancelUrl: string;
};

export type CreatePaymentIntentResult = {
  checkoutUrl: string | null;
  metadata?: Record<string, string>;
  providerPaymentId: string | null;
  status: PaymentStatus;
};

export type VerifyPaymentInput = {
  providerPaymentId: string | null;
};

export type VerifyPaymentResult = {
  failureReason?: string;
  status: PaymentStatus;
};

export type VerifyWebhookInput = {
  headers: Readonly<Record<string, string | undefined>>;
  rawBody: Buffer;
};

export type VerifiedWebhookEvent = {
  eventType: string;
  externalEventId: string;
  failureReason?: string;
  paymentStatus: PaymentStatus | null;
  payload: unknown;
  providerCreatedAt: Date | null;
  providerPaymentId: string | null;
  providerRefundId: string | null;
  refundAmount: string | null;
  refundCurrency: string | null;
  refundStatus: PaymentRefundStatus | null;
};

export type RefundPaymentInput = {
  amount: string;
  currency: string;
  idempotencyKey: string;
  providerPaymentId: string;
  reason?: string;
};

export type RefundPaymentResult = {
  metadata?: Record<string, string>;
  providerRefundId: string | null;
  status: PaymentRefundStatus;
};

export interface PaymentProviderAdapter {
  readonly provider: PaymentProvider;
  createPaymentIntent(input: CreatePaymentIntentInput): Promise<CreatePaymentIntentResult>;
  verifyPayment(input: VerifyPaymentInput): Promise<VerifyPaymentResult>;
  verifyWebhook(input: VerifyWebhookInput): Promise<VerifiedWebhookEvent>;
  refundPayment(input: RefundPaymentInput): Promise<RefundPaymentResult>;
}
