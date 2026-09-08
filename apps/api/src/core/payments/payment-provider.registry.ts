import { PaymentProvider } from '@prisma/client';
import { AppError } from '../../http/errors/app-error.js';
import { manualPaymentProvider } from './manual-payment.provider.js';
import type { PaymentProviderAdapter } from './payment-provider.js';
import { safepayPaymentProvider } from './safepay-payment.provider.js';

const providers = new Map<PaymentProvider, PaymentProviderAdapter>([
  [PaymentProvider.MANUAL, manualPaymentProvider],
  [PaymentProvider.SAFEPAY, safepayPaymentProvider],
]);

export const getPaymentProvider = (provider: PaymentProvider) => {
  const adapter = providers.get(provider);
  if (!adapter) {
    throw new AppError(
      501,
      'PAYMENT_PROVIDER_NOT_CONFIGURED',
      `${provider} payments are not configured yet.`,
    );
  }
  return adapter;
};

export const replacePaymentProvider = (adapter: PaymentProviderAdapter) => {
  const previous = providers.get(adapter.provider);
  providers.set(adapter.provider, adapter);
  return () => {
    if (previous) providers.set(adapter.provider, previous);
    else providers.delete(adapter.provider);
  };
};
