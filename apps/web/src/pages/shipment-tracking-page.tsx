import { useQuery } from '@tanstack/react-query';
import { Helmet } from 'react-helmet-async';
import { FiCheck, FiMail, FiMapPin, FiTruck } from 'react-icons/fi';
import { Link, useParams } from 'react-router-dom';
import { ShipmentStatusBadge } from '../components/shipment-status-badge';
import { SiteHeader } from '../components/site-header';
import { getApiErrorMessage } from '../lib/api-error';
import { formatDate } from '../lib/format-date';
import { orderQueryKeys, ordersApi } from '../lib/orders-api';

export const ShipmentTrackingPage = () => {
  const { id = '' } = useParams();
  const tracking = useQuery({
    enabled: Boolean(id),
    queryFn: () => ordersApi.getTracking(id),
    queryKey: orderQueryKeys.tracking(id),
  });
  const shipment = tracking.data?.shipment;
  const notifications = tracking.data?.notifications ?? [];

  return (
    <>
      <Helmet>
        <title>Track shipment — Veyora</title>
      </Helmet>
      <main className="bg-porcelain min-h-screen px-6 py-8 sm:px-10 lg:px-16">
        <div className="mx-auto w-full max-w-7xl">
          <SiteHeader />
          <section className="py-16">
            <Link className="text-ink/50 text-sm underline" to={`/orders/${id}`}>
              ← Back to order
            </Link>
            <p className="text-champagne mt-8 text-xs font-bold tracking-[0.2em] uppercase">
              Fulfillment
            </p>
            <h1 className="font-display mt-2 text-5xl sm:text-6xl">Track your shipment</h1>
            {tracking.isPending ? (
              <div className="bg-mist mt-10 h-80 animate-pulse rounded-[2rem]" />
            ) : null}
            {tracking.isError ? (
              <div className="mt-10 rounded-2xl border border-red-200 bg-red-50 p-6" role="alert">
                <p className="font-semibold">Tracking information could not be loaded.</p>
                <p className="mt-2 text-sm">{getApiErrorMessage(tracking.error)}</p>
              </div>
            ) : null}
            {tracking.isSuccess && !shipment ? (
              <div className="border-ink/10 mt-10 rounded-[2rem] border bg-white p-8">
                <FiTruck className="text-champagne text-3xl" />
                <h2 className="font-display mt-4 text-3xl">Preparing for fulfillment</h2>
                <p className="text-ink/55 mt-3 max-w-xl text-sm leading-6">
                  A shipment has not been created yet. Tracking details will appear here as soon as
                  the store begins packing your order.
                </p>
              </div>
            ) : null}
            {shipment ? (
              <div className="mt-10 grid gap-8 xl:grid-cols-[minmax(0,1fr)_22rem]">
                <section className="border-ink/10 rounded-[2rem] border bg-white p-6 sm:p-8">
                  <div className="flex flex-wrap items-start justify-between gap-5">
                    <div>
                      <p className="text-ink/45 text-xs tracking-[0.12em] uppercase">
                        {shipment.order.orderNumber}
                      </p>
                      <h2 className="font-display mt-2 text-3xl">{shipment.courier}</h2>
                      <p className="text-ink/55 mt-2 text-sm">
                        Tracking number: {shipment.trackingNumber ?? 'Pending assignment'}
                      </p>
                    </div>
                    <ShipmentStatusBadge status={shipment.status} />
                  </div>
                  <ol className="mt-10 space-y-0">
                    {[...shipment.events].reverse().map((event, index) => (
                      <li
                        className="relative grid grid-cols-[2.5rem_1fr] gap-3 pb-8"
                        key={event.id}
                      >
                        {index < shipment.events.length - 1 ? (
                          <span className="bg-ink/10 absolute top-9 bottom-0 left-[1.18rem] w-px" />
                        ) : null}
                        <span className="bg-ink z-10 grid h-10 w-10 place-items-center rounded-full text-white">
                          {index === 0 ? <FiTruck /> : <FiCheck />}
                        </span>
                        <div className="pt-1">
                          <p className="font-semibold">{event.status.replaceAll('_', ' ')}</p>
                          <p className="text-ink/45 mt-1 text-xs">{formatDate(event.occurredAt)}</p>
                          {event.location ? (
                            <p className="text-ink/55 mt-2 flex items-center gap-2 text-sm">
                              <FiMapPin /> {event.location}
                            </p>
                          ) : null}
                          {event.message ? (
                            <p className="text-ink/60 mt-2 text-sm leading-6">{event.message}</p>
                          ) : null}
                        </div>
                      </li>
                    ))}
                  </ol>
                </section>
                <aside className="border-ink/10 h-fit rounded-[2rem] border bg-white p-6">
                  <FiMail className="text-champagne text-2xl" />
                  <h2 className="font-display mt-3 text-2xl">Email updates</h2>
                  <p className="text-ink/50 mt-2 text-sm leading-6">
                    Delivery messages are sent in the background and never delay your order.
                  </p>
                  {notifications.length ? (
                    <ul className="mt-5 space-y-3">
                      {notifications.map((notification) => (
                        <li className="bg-mist/60 rounded-xl p-3 text-sm" key={notification.id}>
                          <p className="font-semibold">
                            {notification.notificationType.replaceAll('_', ' ')}
                          </p>
                          <p className="text-ink/50 mt-1 text-xs">
                            {notification.status === 'SENT' && notification.sentAt
                              ? `Sent ${formatDate(notification.sentAt)}`
                              : notification.status.replaceAll('_', ' ')}
                          </p>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-ink/45 mt-5 text-sm">No fulfillment emails queued yet.</p>
                  )}
                </aside>
              </div>
            ) : null}
          </section>
        </div>
      </main>
    </>
  );
};
