import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { ReturnStatusBadge } from '../components/return-status-badge';
import { SiteHeader } from '../components/site-header';
import { getApiErrorMessage } from '../lib/api-error';
import { formatDate } from '../lib/format-date';
import { formatPrice } from '../lib/format-price';
import { returnQueryKeys, returnsApi } from '../lib/returns-api';

const pageSize = 10;

export const ReturnsPage = () => {
  const [page, setPage] = useState(1);
  const query = useQuery({
    queryFn: () => returnsApi.list(page, pageSize),
    queryKey: returnQueryKeys.list(page, pageSize),
  });
  return (
    <>
      <Helmet>
        <title>My Returns — Veyora</title>
      </Helmet>
      <main className="bg-porcelain min-h-screen px-4 py-8 sm:px-10 lg:px-16">
        <div className="mx-auto max-w-6xl">
          <SiteHeader />
          <section className="py-14">
            <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
              <div>
                <p className="text-champagne text-xs font-bold tracking-[0.2em] uppercase">
                  After-sales service
                </p>
                <h1 className="font-display mt-3 text-5xl sm:text-6xl">My returns</h1>
              </div>
              <Link
                className="bg-ink rounded-full px-5 py-3 text-center text-sm font-semibold text-white"
                to="/orders"
              >
                Choose an order
              </Link>
            </div>
            {query.isPending ? (
              <div className="bg-mist mt-10 h-56 animate-pulse rounded-[2rem]" />
            ) : null}
            {query.isError ? (
              <div className="mt-10 rounded-2xl border border-red-200 bg-red-50 p-6" role="alert">
                {getApiErrorMessage(query.error)}
              </div>
            ) : null}
            {query.data?.items.length === 0 ? (
              <div className="border-ink/10 mt-10 rounded-[2rem] border bg-white p-10 text-center">
                <h2 className="font-display text-3xl">No returns yet</h2>
                <p className="text-ink/55 mt-2">
                  Eligible delivered orders can be returned from their order page.
                </p>
              </div>
            ) : null}
            {query.data?.items.length ? (
              <div className="mt-10 space-y-4">
                {query.data.items.map((item) => (
                  <Link
                    className="border-ink/10 block rounded-2xl border bg-white p-5 transition hover:shadow-md"
                    key={item.id}
                    to={`/returns/${item.id}`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <p className="text-ink/45 text-xs uppercase">
                          {formatDate(item.createdAt)}
                        </p>
                        <h2 className="font-display mt-1 text-2xl">{item.returnNumber}</h2>
                        <p className="text-ink/55 mt-1 text-sm">
                          Order {item.order.orderNumber} · {item.items.length} item line(s)
                        </p>
                      </div>
                      <div className="text-right">
                        <ReturnStatusBadge status={item.status} />
                        <p className="mt-2 text-sm font-semibold">
                          {formatPrice(
                            String(
                              item.items.reduce((sum, row) => sum + Number(row.refundAmount), 0),
                            ),
                            item.items[0]?.currency ?? 'PKR',
                          )}
                        </p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : null}
            {query.data && query.data.pagination.totalPages > 1 ? (
              <div className="mt-8 flex items-center justify-between">
                <button
                  className="rounded-full border px-5 py-2 disabled:opacity-40"
                  disabled={page <= 1 || query.isFetching}
                  onClick={() => setPage((value) => value - 1)}
                >
                  Previous
                </button>
                <span className="text-sm">
                  Page {page} of {query.data.pagination.totalPages}
                </span>
                <button
                  className="rounded-full border px-5 py-2 disabled:opacity-40"
                  disabled={page >= query.data.pagination.totalPages || query.isFetching}
                  onClick={() => setPage((value) => value + 1)}
                >
                  Next
                </button>
              </div>
            ) : null}
          </section>
        </div>
      </main>
    </>
  );
};
