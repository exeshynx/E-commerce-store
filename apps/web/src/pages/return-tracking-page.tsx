import { useQuery } from '@tanstack/react-query';
import { Helmet } from 'react-helmet-async';
import { FiCheck, FiTruck } from 'react-icons/fi';
import { Link, useParams } from 'react-router-dom';
import { SiteHeader } from '../components/site-header';
import { getApiErrorMessage } from '../lib/api-error';
import { formatDate } from '../lib/format-date';
import { returnQueryKeys, returnsApi } from '../lib/returns-api';

export const ReturnTrackingPage = () => {
  const { id = '' } = useParams();
  const query = useQuery({
    enabled: Boolean(id),
    queryFn: () => returnsApi.get(id),
    queryKey: returnQueryKeys.detail(id),
  });
  const shipment = query.data?.returnRequest.shipment;
  return (
    <>
      <Helmet>
        <title>Return tracking — Veyora</title>
      </Helmet>
      <main className="bg-porcelain min-h-screen px-4 py-8 sm:px-10 lg:px-16">
        <div className="mx-auto max-w-5xl">
          <SiteHeader />
          <section className="py-14">
            <Link className="text-sm underline" to={`/returns/${id}`}>
              ← Return details
            </Link>
            <h1 className="font-display mt-6 text-5xl">Return tracking</h1>
            {query.isPending ? (
              <div className="bg-mist mt-8 h-64 animate-pulse rounded-2xl" />
            ) : null}
            {query.isError ? (
              <div className="mt-8 rounded-xl bg-red-50 p-5">{getApiErrorMessage(query.error)}</div>
            ) : null}
            {shipment ? (
              <section className="border-ink/10 mt-8 rounded-2xl border bg-white p-6 sm:p-8">
                <div className="flex flex-wrap justify-between gap-4">
                  <div>
                    <h2 className="font-display text-3xl">
                      {shipment.courier ?? 'Courier pending'}
                    </h2>
                    <p className="text-ink/55 mt-2">
                      Tracking: {shipment.trackingNumber ?? 'Pending'}
                    </p>
                  </div>
                  <span className="h-fit rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-800">
                    {shipment.status.replaceAll('_', ' ')}
                  </span>
                </div>
                {shipment.events.length ? (
                  <ol className="mt-8 space-y-6">
                    {[...shipment.events].reverse().map((event, index) => (
                      <li className="grid grid-cols-[2.5rem_1fr] gap-3" key={event.id}>
                        <span className="bg-ink grid h-10 w-10 place-items-center rounded-full text-white">
                          {index === 0 ? <FiTruck /> : <FiCheck />}
                        </span>
                        <div>
                          <p className="font-semibold">{event.status.replaceAll('_', ' ')}</p>
                          <p className="text-ink/45 text-xs">{formatDate(event.occurredAt)}</p>
                          {event.location ? <p className="mt-1 text-sm">{event.location}</p> : null}
                          {event.message ? (
                            <p className="text-ink/60 mt-1 text-sm">{event.message}</p>
                          ) : null}
                        </div>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="text-ink/50 mt-8 text-sm">
                    Tracking events will appear after the return is shipped.
                  </p>
                )}
              </section>
            ) : query.isSuccess ? (
              <p className="mt-8 rounded-2xl border bg-white p-6">
                Return shipment information is not available yet.
              </p>
            ) : null}
          </section>
        </div>
      </main>
    </>
  );
};
