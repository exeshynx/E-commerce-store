import { useQuery } from '@tanstack/react-query';
import { Helmet } from 'react-helmet-async';
import { Link, useParams } from 'react-router-dom';
import { ReturnStatusBadge } from '../components/return-status-badge';
import { SiteHeader } from '../components/site-header';
import { getApiErrorMessage } from '../lib/api-error';
import { formatDate } from '../lib/format-date';
import { formatPrice } from '../lib/format-price';
import { returnQueryKeys, returnsApi } from '../lib/returns-api';

export const ReturnDetailPage = () => {
  const { id = '' } = useParams();
  const query = useQuery({
    enabled: Boolean(id),
    queryFn: () => returnsApi.get(id),
    queryKey: returnQueryKeys.detail(id),
  });
  const request = query.data?.returnRequest;
  return (
    <>
      <Helmet>
        <title>Return details — Veyora</title>
      </Helmet>
      <main className="bg-porcelain min-h-screen px-4 py-8 sm:px-10 lg:px-16">
        <div className="mx-auto max-w-6xl">
          <SiteHeader />
          <section className="py-14">
            <Link className="text-sm underline" to="/returns">
              ← My returns
            </Link>
            {query.isPending ? (
              <div className="bg-mist mt-8 h-72 animate-pulse rounded-[2rem]" />
            ) : null}
            {query.isError ? (
              <div className="mt-8 rounded-2xl border border-red-200 bg-red-50 p-6">
                {getApiErrorMessage(query.error)}
              </div>
            ) : null}
            {request ? (
              <div className="mt-8 space-y-6">
                <header className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
                  <div>
                    <p className="text-champagne text-xs font-bold uppercase">
                      Return authorization
                    </p>
                    <h1 className="font-display mt-2 text-4xl sm:text-5xl">
                      {request.returnNumber}
                    </h1>
                    <p className="text-ink/50 mt-2">
                      Requested {formatDate(request.createdAt)} for {request.order.orderNumber}
                    </p>
                  </div>
                  <ReturnStatusBadge status={request.status} />
                </header>
                <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
                  <section className="border-ink/10 rounded-2xl border bg-white p-6">
                    <h2 className="font-display text-2xl">Returned items</h2>
                    <ul className="mt-5 divide-y">
                      {request.items.map((item) => (
                        <li className="py-4 first:pt-0" key={item.id}>
                          <div className="flex justify-between gap-4">
                            <div>
                              <p className="font-semibold">{item.productName}</p>
                              <p className="text-ink/50 text-sm">
                                {item.sku} · Qty {item.quantity} ·{' '}
                                {item.reason.replaceAll('_', ' ')}
                              </p>
                              {item.reasonDetails ? (
                                <p className="text-ink/55 mt-2 text-sm">{item.reasonDetails}</p>
                              ) : null}
                            </div>
                            <p className="font-semibold">
                              {formatPrice(item.refundAmount, item.currency)}
                            </p>
                          </div>
                        </li>
                      ))}
                    </ul>
                    {request.customerNote ? (
                      <div className="bg-mist mt-5 rounded-xl p-4 text-sm">
                        {request.customerNote}
                      </div>
                    ) : null}
                    {request.rejectionReason ? (
                      <p className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-800">
                        {request.rejectionReason}
                      </p>
                    ) : null}
                    {request.inspectionNotes ? (
                      <div className="mt-5">
                        <p className="text-xs font-bold uppercase">Inspection notes</p>
                        <p className="text-ink/60 mt-2 text-sm">{request.inspectionNotes}</p>
                      </div>
                    ) : null}
                  </section>
                  <aside className="space-y-4">
                    <Link
                      className="bg-ink block rounded-xl px-5 py-3 text-center text-sm font-semibold text-white"
                      to={`/returns/${id}/tracking`}
                    >
                      Return tracking
                    </Link>
                    <div className="border-ink/10 rounded-2xl border bg-white p-5">
                      <h2 className="font-display text-xl">Refund history</h2>
                      {request.refunds.length ? (
                        <ul className="mt-4 space-y-3">
                          {request.refunds.map((refund) => (
                            <li className="bg-mist rounded-xl p-3 text-sm" key={refund.id}>
                              <p className="font-semibold">
                                {formatPrice(refund.amount, refund.currency)}
                              </p>
                              <p className="text-ink/50 text-xs">
                                {refund.status.replaceAll('_', ' ')}
                              </p>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-ink/50 mt-3 text-sm">No refund recorded yet.</p>
                      )}
                    </div>
                  </aside>
                </div>
              </div>
            ) : null}
          </section>
        </div>
      </main>
    </>
  );
};
