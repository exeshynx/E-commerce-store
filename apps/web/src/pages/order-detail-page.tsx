import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Helmet } from 'react-helmet-async';
import { Link, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { OrderDetails } from '../components/order-details';
import { PaymentHistory } from '../components/payment-history';
import { SiteHeader } from '../components/site-header';
import { getApiErrorMessage } from '../lib/api-error';
import { orderQueryKeys, ordersApi } from '../lib/orders-api';

export const OrderDetailPage = () => {
  const { id = '' } = useParams();
  const queryClient = useQueryClient();
  const orderQuery = useQuery({
    enabled: Boolean(id),
    queryFn: () => ordersApi.getOrder(id),
    queryKey: orderQueryKeys.detail(id),
  });
  const paymentQuery = useQuery({
    enabled: Boolean(id),
    queryFn: () => ordersApi.getPayments(id),
    queryKey: orderQueryKeys.payments(id),
  });
  const initiatePayment = useMutation({
    mutationFn: (idempotencyKey: string) => ordersApi.initiateSafepayPayment(id, idempotencyKey),
    onSuccess: async (result) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: orderQueryKeys.detail(id) }),
        queryClient.invalidateQueries({ queryKey: orderQueryKeys.payments(id) }),
      ]);
      if (result.checkoutUrl) {
        window.location.assign(result.checkoutUrl);
        return;
      }
      toast.success('Payment is waiting for confirmation.');
    },
  });
  const order = orderQuery.data?.order;
  const payments = paymentQuery.data?.items ?? [];
  const hasOpenPayment = payments.some(
    (payment) => payment.status === 'PENDING' || payment.status === 'PROCESSING',
  );

  return (
    <>
      <Helmet>
        <title>Order Details — Veyora</title>
      </Helmet>
      <main className="bg-porcelain min-h-screen px-6 py-8 sm:px-10 lg:px-16">
        <div className="mx-auto w-full max-w-7xl">
          <SiteHeader />
          <section className="py-16">
            <Link className="text-ink/50 text-sm underline" to="/orders">
              ← Back to orders
            </Link>
            <h1 className="font-display mt-6 text-6xl">Order details</h1>
            {orderQuery.isPending ? (
              <div className="bg-mist mt-10 h-96 animate-pulse rounded-[2rem]" />
            ) : null}
            {orderQuery.isError ? (
              <div className="mt-10 rounded-[1.5rem] border border-red-200 bg-red-50 p-8">
                <p>{getApiErrorMessage(orderQuery.error)}</p>
                <Link className="mt-4 inline-block font-semibold underline" to="/orders">
                  Return to order history
                </Link>
              </div>
            ) : null}
            {order ? (
              <>
                <OrderDetails order={order} />
                <section className="border-ink/10 mt-8 flex flex-wrap items-center justify-between gap-4 rounded-[2rem] border bg-white p-6 sm:p-8">
                  <div>
                    <h2 className="font-display text-3xl">Shipment tracking</h2>
                    <p className="text-ink/50 mt-2 text-sm">
                      Follow packing, courier handoff, transit, and delivery updates.
                    </p>
                  </div>
                  <Link
                    className="bg-ink rounded-xl px-5 py-3 text-sm font-semibold text-white"
                    to={`/orders/${order.id}/tracking`}
                  >
                    View tracking
                  </Link>
                </section>
                {order.status === 'DELIVERED' ? (
                  <section className="border-ink/10 mt-8 flex flex-wrap items-center justify-between gap-4 rounded-[2rem] border bg-white p-6 sm:p-8">
                    <div>
                      <h2 className="font-display text-3xl">Need to return an item?</h2>
                      <p className="text-ink/50 mt-2 text-sm">
                        Request a partial or complete return during the eligible return window.
                      </p>
                    </div>
                    <Link
                      className="border-ink/15 rounded-xl border px-5 py-3 text-sm font-semibold"
                      to={`/orders/${order.id}/return`}
                    >
                      Start a return
                    </Link>
                  </section>
                ) : null}
                <section className="border-ink/10 mt-8 rounded-[2rem] border bg-white p-6 sm:p-8">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <h2 className="font-display text-3xl">Payment status</h2>
                      <p className="text-ink/50 mt-2 text-sm">
                        Safepay confirms payments securely through a signed server webhook.
                      </p>
                    </div>
                    {(order.status === 'PENDING' || order.status === 'AWAITING_PAYMENT') &&
                    !hasOpenPayment ? (
                      <button
                        className="bg-ink rounded-xl px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
                        disabled={initiatePayment.isPending}
                        onClick={() => initiatePayment.mutate(crypto.randomUUID())}
                        type="button"
                      >
                        {initiatePayment.isPending
                          ? 'Opening Safepay…'
                          : 'Pay securely with Safepay'}
                      </button>
                    ) : null}
                  </div>
                  {initiatePayment.isError ? (
                    <p className="mt-4 text-sm text-red-700" role="alert">
                      {getApiErrorMessage(initiatePayment.error)}
                    </p>
                  ) : null}
                  {paymentQuery.isPending ? (
                    <div className="bg-mist mt-6 h-28 animate-pulse rounded-2xl" />
                  ) : null}
                  {paymentQuery.isError ? (
                    <p className="mt-6 text-sm text-red-700" role="alert">
                      {getApiErrorMessage(paymentQuery.error)}
                    </p>
                  ) : null}
                  {payments.length ? (
                    <div className="mt-6">
                      <PaymentHistory payments={payments} />
                    </div>
                  ) : null}
                  {hasOpenPayment ? (
                    <p className="mt-5 rounded-xl bg-blue-50 px-4 py-3 text-sm text-blue-800">
                      Payment is pending. The final result appears after Safepay's signed webhook is
                      processed.
                    </p>
                  ) : null}
                  {paymentQuery.isSuccess && payments.length === 0 ? (
                    <p className="text-ink/50 mt-6 text-sm">
                      No payment attempts have been recorded. Start Safepay checkout when you are
                      ready.
                    </p>
                  ) : null}
                </section>
              </>
            ) : null}
          </section>
        </div>
      </main>
    </>
  );
};
