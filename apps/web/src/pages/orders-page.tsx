import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { OrderStatusBadge } from '../components/order-status-badge';
import { SiteHeader } from '../components/site-header';
import { getApiErrorMessage } from '../lib/api-error';
import { formatDate } from '../lib/format-date';
import { formatPrice } from '../lib/format-price';
import { orderQueryKeys, ordersApi } from '../lib/orders-api';

const pageSize = 10;

export const OrdersPage = () => {
  const [page, setPage] = useState(1);
  const ordersQuery = useQuery({
    queryFn: () => ordersApi.listOrders(page, pageSize),
    queryKey: orderQueryKeys.list(page, pageSize),
  });
  const orders = ordersQuery.data;

  return (
    <>
      <Helmet>
        <title>Your Orders — Veyora</title>
      </Helmet>
      <main className="bg-porcelain min-h-screen px-6 py-8 sm:px-10 lg:px-16">
        <div className="mx-auto w-full max-w-6xl">
          <SiteHeader />
          <section className="py-16">
            <p className="text-champagne text-xs font-semibold tracking-[0.24em] uppercase">
              Order history
            </p>
            <h1 className="font-display mt-5 text-6xl">Your orders</h1>
            {ordersQuery.isPending ? (
              <div className="mt-12 space-y-5">
                {[0, 1].map((item) => (
                  <div className="bg-mist h-40 animate-pulse rounded-[1.5rem]" key={item} />
                ))}
              </div>
            ) : null}
            {ordersQuery.isError ? (
              <div className="mt-12 rounded-[1.5rem] border border-red-200 bg-red-50 p-8">
                <p>{getApiErrorMessage(ordersQuery.error)}</p>
                <button
                  className="mt-4 font-semibold underline"
                  onClick={() => void ordersQuery.refetch()}
                >
                  Try again
                </button>
              </div>
            ) : null}
            {orders && orders.items.length === 0 ? (
              <div className="border-ink/10 mt-12 rounded-[2rem] border p-12 text-center">
                <h2 className="font-display text-4xl">No orders yet.</h2>
                <p className="text-ink/55 mt-3">Your completed checkouts will appear here.</p>
                <Link className="mt-6 inline-block font-semibold underline" to="/products">
                  Browse products
                </Link>
              </div>
            ) : null}
            {orders?.items.length ? (
              <div className="mt-12 space-y-5">
                {orders.items.map((order) => (
                  <Link
                    className="border-ink/10 block rounded-[1.5rem] border bg-white/50 p-6 transition hover:bg-white/80"
                    key={order.id}
                    to={`/orders/${order.id}`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-5">
                      <div>
                        <p className="text-ink/45 text-xs tracking-[0.12em] uppercase">
                          {formatDate(order.createdAt)}
                        </p>
                        <h2 className="font-display mt-2 text-3xl">{order.orderNumber}</h2>
                        <p className="text-ink/50 mt-2 text-sm">
                          {order.items.length} {order.items.length === 1 ? 'item' : 'items'}
                        </p>
                      </div>
                      <div className="text-right">
                        <OrderStatusBadge status={order.status} />
                        <p className="mt-4 font-semibold">
                          {formatPrice(order.total, order.currency)}
                        </p>
                      </div>
                    </div>
                  </Link>
                ))}
                {orders.pagination.totalPages > 1 ? (
                  <div className="flex items-center justify-between pt-5">
                    <button
                      className="border-ink/15 rounded-full border px-5 py-2 text-xs font-semibold uppercase disabled:opacity-40"
                      disabled={page === 1 || ordersQuery.isFetching}
                      onClick={() => setPage((current) => current - 1)}
                      type="button"
                    >
                      Previous
                    </button>
                    <span className="text-ink/50 text-sm">
                      Page {orders.pagination.page} of {orders.pagination.totalPages}
                    </span>
                    <button
                      className="border-ink/15 rounded-full border px-5 py-2 text-xs font-semibold uppercase disabled:opacity-40"
                      disabled={page >= orders.pagination.totalPages || ordersQuery.isFetching}
                      onClick={() => setPage((current) => current + 1)}
                      type="button"
                    >
                      Next
                    </button>
                  </div>
                ) : null}
              </div>
            ) : null}
          </section>
        </div>
      </main>
    </>
  );
};
