import Safepay from '@sfpy/node-core';

export type SafepayEnvironment = 'sandbox' | 'production';

export type SafepayTrackerInput = {
  amount: number;
  currency: string;
  idempotencyKey: string;
  orderId: string;
  paymentAttemptId: string;
  publicKey: string;
};

export interface SafepayGatewayClient {
  createCheckoutUrl(input: {
    cancelUrl: string;
    environment: SafepayEnvironment;
    orderId: string;
    passportToken: string;
    returnUrl: string;
    tracker: string;
  }): string;
  createPassportToken(): Promise<unknown>;
  createTracker(input: SafepayTrackerInput): Promise<unknown>;
  fetchPayment(providerPaymentId: string): Promise<unknown>;
  refundPayment(
    providerPaymentId: string,
    input: { amount: number; currency: string; idempotencyKey: string; reason?: string },
  ): Promise<unknown>;
}

export const createSafepayGatewayClient = (input: {
  environment: SafepayEnvironment;
  secretKey: string;
}): SafepayGatewayClient => {
  const host =
    input.environment === 'production'
      ? 'https://api.getsafepay.com'
      : 'https://sandbox.api.getsafepay.com';
  const sdk = new Safepay(input.secretKey, {
    authType: 'secret',
    host,
    timeout: 15_000,
  });

  return {
    createCheckoutUrl: ({ cancelUrl, environment, orderId, passportToken, returnUrl, tracker }) =>
      sdk.checkout.createCheckoutUrl({
        cancel_url: cancelUrl,
        env: environment,
        order_id: orderId,
        redirect_url: returnUrl,
        source: 'hosted',
        tbt: passportToken,
        tracker,
      }),
    createPassportToken: () => sdk.client.passport.create(),
    createTracker: ({ amount, currency, idempotencyKey, orderId, paymentAttemptId, publicKey }) =>
      sdk.payments.session.setup({
        amount,
        currency,
        entry_mode: 'raw',
        include_fees: false,
        intent: 'CYBERSOURCE',
        merchant_api_key: publicKey,
        metadata: {
          veyora_idempotency_key: idempotencyKey,
          order_id: orderId,
          payment_attempt_id: paymentAttemptId,
        },
        mode: 'payment',
      }),
    fetchPayment: (providerPaymentId) => sdk.reporter.payments.fetch(providerPaymentId),
    refundPayment: (providerPaymentId, { amount, currency, idempotencyKey, reason }) =>
      sdk.order.cancel.refund(providerPaymentId, {
        amount,
        currency,
        idempotency_key: idempotencyKey,
        ...(reason ? { reason } : {}),
      }),
  };
};
