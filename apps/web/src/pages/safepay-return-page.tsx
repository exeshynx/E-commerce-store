import { useQuery } from '@tanstack/react-query';
import { Helmet } from 'react-helmet-async';
import { Link, useSearchParams } from 'react-router-dom';
import { PaymentHistory } from '../components/payment-history';
import { SiteHeader } from '../components/site-header';
import { getApiErrorMessage } from '../lib/api-error';
import { orderQueryKeys, ordersApi } from '../lib/orders-api';

export const SafepayReturnPage = () => {
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get('orderId') ?? '';
  const cancelled = searchParams.get('cancelled') === 'true';
  const payments = useQuery({
    enabled: Boolean(orderId),
    queryFn: () => ordersApi.getPayments(orderId),
    queryKey: orderQueryKeys.payments(orderId),
    refetchInterval: (query) => {
      const attempts = query.state.data?.items ?? [];
      return attempts.some(
        (payment) => payment.status === 'PENDING' || payment.status === 'PROCESSING',
      )
        ? 2_000
        : false;
    },
  });
  const attempts = payments.data?.items ?? [];
  const latest = attempts[0];
  const succeeded = attempts.some((payment) => payment.status === 'SUCCEEDED');
  const failed = latest?.status === 'FAILED' || latest?.status === 'CANCELLED' || cancelled;

  return (
    <>
      <Helmet>
        <title>Payment status — Veyora</title>
      </Helmet>
      <main className="bg-porcelain min-h-screen px-6 py-8 sm:px-10 lg:px-16">
        <div className="mx-auto w-full max-w-5xl">
          <SiteHeader />
          <section className="py-16">
            <p className="text-gold text-xs tracking-[0.22em] uppercase">Safepay checkout</p>
            <h1 className="font-display mt-4 text-5xl sm:text-6xl">
              {succeeded
                ? 'Payment confirmed'
                : failed
                  ? 'Payment not completed'
                  : 'Confirming your payment'}
            </h1>
            <div className="border-ink/10 mt-8 rounded-[2rem] border bg-white p-6 sm:p-8">
              {!orderId ? (
                <p className="text-red-700">
                  The payment return URL is missing its order reference.
                </p>
              ) : null}
              {payments.isPending ? (
                <div className="bg-mist h-32 animate-pulse rounded-2xl" />
              ) : null}
              {payments.isError ? (
                <p className="text-red-700" role="alert">
                  {getApiErrorMessage(payments.error)}
                </p>
              ) : null}
              {succeeded ? (
                <p className="text-emerald-800">
                  Safepay confirmed the payment. Your order can now move into processing.
                </p>
              ) : null}
              {failed ? (
                <p className="text-red-700">
                  No charge was confirmed. Return to the order to review the failure or try again.
                </p>
              ) : null}
              {!succeeded && !failed && payments.isSuccess ? (
                <p className="text-blue-800" aria-live="polite">
                  The browser redirect is not proof of payment. We are waiting for the signed
                  Safepay webhook and will refresh this status automatically.
                </p>
              ) : null}
              {attempts.length ? (
                <div className="mt-6">
                  <PaymentHistory payments={attempts} />
                </div>
              ) : null}
              {orderId ? (
                <Link
                  className="bg-ink mt-7 inline-flex rounded-xl px-5 py-3 text-sm font-semibold text-white"
                  to={`/orders/${orderId}`}
                >
                  View order details
                </Link>
              ) : (
                <Link className="mt-7 inline-block font-semibold underline" to="/orders">
                  Return to order history
                </Link>
              )}
            </div>
          </section>
        </div>
      </main>
    </>
  );
};
