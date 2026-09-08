import { useQuery } from '@tanstack/react-query';
import { Helmet } from 'react-helmet-async';
import { Link, useParams } from 'react-router-dom';
import { OrderDetails } from '../components/order-details';
import { SiteHeader } from '../components/site-header';
import { getApiErrorMessage } from '../lib/api-error';
import { orderQueryKeys, ordersApi } from '../lib/orders-api';
import { useAuthStore } from '../stores/auth-store';

export const OrderConfirmationPage = () => {
  const { id = '' } = useParams();
  const user = useAuthStore((state) => state.user);
  const orderQuery = useQuery({
    enabled: Boolean(id),
    queryFn: () => ordersApi.getOrder(id),
    queryKey: orderQueryKeys.detail(id),
  });

  return (
    <>
      <Helmet>
        <title>Order confirmed — Veyora</title>
      </Helmet>
      <main className="bg-porcelain min-h-screen px-6 py-8 sm:px-10 lg:px-16">
        <div className="mx-auto w-full max-w-7xl">
          <SiteHeader />
          <section className="py-16">
            <p className="text-champagne text-xs font-semibold tracking-[0.24em] uppercase">
              Order created
            </p>
            <h1 className="font-display mt-5 text-6xl">Thank you.</h1>
            <p className="text-ink/55 mt-5 max-w-2xl leading-7">
              Your order has been recorded successfully. Continue to its secure Safepay checkout
              when you are ready to pay.
            </p>
            {orderQuery.isPending ? (
              <div className="bg-mist mt-10 h-96 animate-pulse rounded-[2rem]" />
            ) : null}
            {orderQuery.isError ? (
              <div className="mt-10 rounded-[1.5rem] border border-red-200 bg-red-50 p-8">
                <p>{getApiErrorMessage(orderQuery.error)}</p>
                <Link className="mt-4 inline-block font-semibold underline" to="/orders">
                  View order history
                </Link>
              </div>
            ) : null}
            {orderQuery.data?.order ? <OrderDetails order={orderQuery.data.order} /> : null}
            <div className="mt-10 flex flex-wrap gap-4">
              {orderQuery.data?.order ? (
                <Link
                  className="bg-ink rounded-full px-7 py-3 text-xs font-semibold tracking-[0.12em] text-white uppercase"
                  to={`/orders/${orderQuery.data.order.id}`}
                >
                  Continue to payment
                </Link>
              ) : null}
              {user ? (
                <Link
                  className="border-ink/15 rounded-full border px-7 py-3 text-xs font-semibold tracking-[0.12em] uppercase"
                  to="/orders"
                >
                  View all orders
                </Link>
              ) : null}
              <Link
                className="border-ink/15 rounded-full border px-7 py-3 text-xs font-semibold tracking-[0.12em] uppercase"
                to="/products"
              >
                Continue shopping
              </Link>
            </div>
          </section>
        </div>
      </main>
    </>
  );
};
