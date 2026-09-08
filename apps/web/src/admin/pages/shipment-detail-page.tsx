import type { AdminShipmentUpdateRequest, ShipmentStatus } from '@veyora/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { ShipmentStatusBadge } from '../../components/shipment-status-badge';
import { adminApi, adminQueryKeys } from '../../lib/admin-api';
import { getApiErrorMessage } from '../../lib/api-error';
import { formatDate } from '../../lib/format-date';
import {
  AdminBadge,
  AdminErrorState,
  AdminLoadingState,
  AdminPageHeader,
} from '../components/admin-ui';

const nextStatuses: Record<ShipmentStatus, ShipmentStatus[]> = {
  DELIVERED: ['RETURNED'],
  OUT_FOR_DELIVERY: ['DELIVERED', 'RETURNED'],
  PACKING: ['READY_TO_SHIP'],
  READY_TO_SHIP: ['SHIPPED'],
  RETURNED: [],
  SHIPPED: ['OUT_FOR_DELIVERY', 'DELIVERED', 'RETURNED'],
};

export const AdminShipmentDetailPage = () => {
  const { id = '' } = useParams();
  const queryClient = useQueryClient();
  const shipmentQuery = useQuery({
    enabled: Boolean(id),
    queryFn: () => adminApi.getShipment(id),
    queryKey: adminQueryKeys.shipment(id),
  });
  const shipment = shipmentQuery.data?.shipment;
  const notifications = shipmentQuery.data?.notifications ?? [];
  const [status, setStatus] = useState<ShipmentStatus | ''>('');
  const [location, setLocation] = useState('');
  const [message, setMessage] = useState('');

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: adminQueryKeys.shipment(id) }),
      queryClient.invalidateQueries({ queryKey: ['admin', 'shipments'] }),
      queryClient.invalidateQueries({ queryKey: ['admin', 'orders'] }),
      queryClient.invalidateQueries({ queryKey: adminQueryKeys.audit({ page: 1, pageSize: 25 }) }),
    ]);
  };
  const update = useMutation({
    mutationFn: (input: AdminShipmentUpdateRequest) => adminApi.updateShipment(id, input),
    onSuccess: async () => {
      toast.success('Shipment details updated.');
      await refresh();
    },
  });
  const submitTracking = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const courierValue = form.get('courier');
    const trackingValue = form.get('trackingNumber');
    const courier = typeof courierValue === 'string' ? courierValue.trim() : '';
    const trackingNumber = typeof trackingValue === 'string' ? trackingValue.trim() : '';
    update.mutate({ courier, trackingNumber: trackingNumber || null });
  };
  const addEvent = useMutation({
    mutationFn: (nextStatus: ShipmentStatus) =>
      adminApi.addShipmentEvent(id, {
        status: nextStatus,
        ...(location.trim() ? { location: location.trim() } : {}),
        ...(message.trim() ? { message: message.trim() } : {}),
      }),
    onSuccess: async () => {
      toast.success('Tracking event recorded.');
      setLocation('');
      setMessage('');
      setStatus('');
      await refresh();
    },
  });
  const available = shipment ? nextStatuses[shipment.status] : [];
  const selectedStatus = status && available.includes(status) ? status : (available[0] ?? '');

  return (
    <>
      <Helmet>
        <title>Shipment details — Veyora Administration</title>
      </Helmet>
      <AdminPageHeader
        actions={
          <Link
            className="border-ink/15 rounded-xl border bg-white px-4 py-2 text-sm font-semibold"
            to="/admin/shipments"
          >
            Back to shipments
          </Link>
        }
        description="Maintain courier data and append trusted tracking events without rewriting history."
        eyebrow="Shipment details"
        title={shipment?.order.orderNumber ?? 'Shipment'}
      />
      <div className="mt-8">
        {shipmentQuery.isPending ? <AdminLoadingState rows={6} /> : null}
        {shipmentQuery.isError ? (
          <AdminErrorState
            message={getApiErrorMessage(shipmentQuery.error)}
            retry={() => void shipmentQuery.refetch()}
          />
        ) : null}
        {shipment ? (
          <div className="space-y-6">
            <section className="border-ink/10 grid gap-5 rounded-2xl border bg-white p-6 sm:grid-cols-2 xl:grid-cols-4">
              <div>
                <p className="text-ink/45 text-xs tracking-[0.12em] uppercase">Status</p>
                <div className="mt-2">
                  <ShipmentStatusBadge status={shipment.status} />
                </div>
              </div>
              <div>
                <p className="text-ink/45 text-xs tracking-[0.12em] uppercase">Customer</p>
                <p className="mt-2 font-semibold">
                  {shipment.order.user.firstName} {shipment.order.user.lastName}
                </p>
                <p className="text-ink/45 text-xs">{shipment.order.user.email}</p>
              </div>
              <div>
                <p className="text-ink/45 text-xs tracking-[0.12em] uppercase">Shipped</p>
                <p className="mt-2 text-sm">
                  {shipment.shippedAt ? formatDate(shipment.shippedAt) : 'Not yet'}
                </p>
              </div>
              <div>
                <p className="text-ink/45 text-xs tracking-[0.12em] uppercase">Delivered</p>
                <p className="mt-2 text-sm">
                  {shipment.deliveredAt ? formatDate(shipment.deliveredAt) : 'Not yet'}
                </p>
              </div>
            </section>
            <div className="grid gap-6 xl:grid-cols-2">
              <form
                className="border-ink/10 rounded-2xl border bg-white p-6"
                onSubmit={submitTracking}
              >
                <h2 className="font-display text-2xl">Courier and tracking</h2>
                <div className="mt-5 space-y-4">
                  <label className="block text-sm font-semibold">
                    Courier
                    <input
                      className="border-ink/15 mt-2 w-full rounded-xl border px-4 py-3 font-normal"
                      defaultValue={shipment.courier}
                      maxLength={120}
                      minLength={2}
                      name="courier"
                      required
                    />
                  </label>
                  <label className="block text-sm font-semibold">
                    Tracking number
                    <input
                      className="border-ink/15 mt-2 w-full rounded-xl border px-4 py-3 font-normal"
                      defaultValue={shipment.trackingNumber ?? ''}
                      maxLength={191}
                      name="trackingNumber"
                      placeholder="Required before shipping"
                    />
                  </label>
                  {update.isError ? (
                    <p className="text-sm text-red-700" role="alert">
                      {getApiErrorMessage(update.error)}
                    </p>
                  ) : null}
                  <button
                    className="bg-ink rounded-xl px-5 py-3 text-sm font-semibold text-white disabled:opacity-40"
                    disabled={update.isPending}
                    type="submit"
                  >
                    {update.isPending ? 'Saving…' : 'Save tracking details'}
                  </button>
                </div>
              </form>
              <section className="border-ink/10 rounded-2xl border bg-white p-6">
                <h2 className="font-display text-2xl">Add tracking event</h2>
                {available.length ? (
                  <div className="mt-5 space-y-4">
                    <label className="block text-sm font-semibold">
                      Next status
                      <select
                        className="border-ink/15 mt-2 w-full rounded-xl border px-4 py-3 font-normal"
                        onChange={(event) => setStatus(event.target.value as ShipmentStatus)}
                        value={selectedStatus}
                      >
                        {available.map((item) => (
                          <option key={item} value={item}>
                            {item.replaceAll('_', ' ')}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block text-sm font-semibold">
                      Location <span className="text-ink/40 font-normal">(optional)</span>
                      <input
                        className="border-ink/15 mt-2 w-full rounded-xl border px-4 py-3 font-normal"
                        maxLength={160}
                        onChange={(event) => setLocation(event.target.value)}
                        value={location}
                      />
                    </label>
                    <label className="block text-sm font-semibold">
                      Customer-facing update{' '}
                      <span className="text-ink/40 font-normal">(optional)</span>
                      <textarea
                        className="border-ink/15 mt-2 min-h-24 w-full rounded-xl border px-4 py-3 font-normal"
                        maxLength={500}
                        onChange={(event) => setMessage(event.target.value)}
                        value={message}
                      />
                    </label>
                    {addEvent.isError ? (
                      <p className="text-sm text-red-700" role="alert">
                        {getApiErrorMessage(addEvent.error)}
                      </p>
                    ) : null}
                    <button
                      className="bg-ink rounded-xl px-5 py-3 text-sm font-semibold text-white disabled:opacity-40"
                      disabled={!selectedStatus || addEvent.isPending}
                      onClick={() => selectedStatus && addEvent.mutate(selectedStatus)}
                      type="button"
                    >
                      {addEvent.isPending ? 'Recording…' : 'Record tracking event'}
                    </button>
                  </div>
                ) : (
                  <p className="text-ink/50 mt-4 text-sm">
                    No further status transitions are available.
                  </p>
                )}
              </section>
            </div>
            <section className="border-ink/10 rounded-2xl border bg-white p-6">
              <h2 className="font-display text-2xl">Tracking timeline</h2>
              <ol className="mt-6 space-y-5">
                {[...shipment.events].reverse().map((event) => (
                  <li className="border-ink/10 border-l-2 pl-4" key={event.id}>
                    <div className="flex flex-wrap items-center gap-3">
                      <ShipmentStatusBadge status={event.status} />
                      <span className="text-ink/45 text-xs">{formatDate(event.occurredAt)}</span>
                    </div>
                    {event.location ? (
                      <p className="mt-2 text-sm font-semibold">{event.location}</p>
                    ) : null}
                    {event.message ? (
                      <p className="text-ink/60 mt-1 text-sm">{event.message}</p>
                    ) : null}
                    {event.administrator ? (
                      <p className="text-ink/40 mt-2 text-xs">
                        Recorded by {event.administrator.firstName} {event.administrator.lastName}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ol>
            </section>
            <section className="border-ink/10 rounded-2xl border bg-white p-6">
              <h2 className="font-display text-2xl">Email delivery</h2>
              {notifications.length ? (
                <ul className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {notifications.map((notification) => (
                    <li className="bg-mist/60 rounded-xl p-4" key={notification.id}>
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold">
                          {notification.notificationType.replaceAll('_', ' ')}
                        </p>
                        <AdminBadge
                          tone={
                            notification.status === 'SENT'
                              ? 'good'
                              : notification.status === 'DEAD_LETTER'
                                ? 'danger'
                                : notification.status === 'FAILED'
                                  ? 'warning'
                                  : 'neutral'
                          }
                        >
                          {notification.status.replaceAll('_', ' ')}
                        </AdminBadge>
                      </div>
                      <p className="text-ink/45 mt-2 text-xs">
                        {notification.sentAt
                          ? `Sent ${formatDate(notification.sentAt)}`
                          : `Queued ${formatDate(notification.createdAt)}`}
                      </p>
                      {notification.lastError ? (
                        <p className="mt-2 text-xs text-red-700">{notification.lastError}</p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-ink/50 mt-4 text-sm">No email notifications recorded.</p>
              )}
            </section>
          </div>
        ) : null}
      </div>
    </>
  );
};
