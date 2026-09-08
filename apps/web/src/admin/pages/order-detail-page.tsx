import type { OrderStatus } from '@veyora/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { OrderDetails } from '../../components/order-details';
import { PaymentHistory } from '../../components/payment-history';
import { getApiErrorMessage } from '../../lib/api-error';
import { adminApi, adminQueryKeys } from '../../lib/admin-api';
import { formatDate } from '../../lib/format-date';
import { AdminErrorState, AdminLoadingState, AdminPageHeader } from '../components/admin-ui';
import { ManualPaymentActions } from '../components/manual-payment-actions';

const allowedTransitions: Record<OrderStatus, OrderStatus[]> = {
  AWAITING_PAYMENT: ['CANCELLED'],
  CANCELLED: [],
  DELIVERED: [],
  PENDING: ['AWAITING_PAYMENT', 'CANCELLED'],
  PROCESSING: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['DELIVERED'],
};

export const AdminOrderDetailPage = () => {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const orderQuery = useQuery({
    enabled: Boolean(id),
    queryFn: () => adminApi.getOrder(id),
    queryKey: adminQueryKeys.order(id),
  });
  const order = orderQuery.data?.order;
  const paymentQuery = useQuery({
    enabled: Boolean(id),
    queryFn: () => adminApi.getOrderPayments(id),
    queryKey: adminQueryKeys.orderPayments(id),
  });
  const payments = paymentQuery.data?.items ?? [];
  const hasOpenPayment = payments.some(
    (payment) => payment.status === 'PENDING' || payment.status === 'PROCESSING',
  );
  const available = order
    ? allowedTransitions[order.status].filter(
        (nextStatus) => !order.shipment || (nextStatus !== 'SHIPPED' && nextStatus !== 'DELIVERED'),
      )
    : [];
  const [status, setStatus] = useState<OrderStatus | ''>('');
  const [note, setNote] = useState('');
  const [courier, setCourier] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');
  const selectedStatus = status && available.includes(status) ? status : (available[0] ?? '');
  const transition = useMutation({
    mutationFn: (input: { status: OrderStatus; note?: string }) =>
      adminApi.updateOrderStatus(id, input),
    onSuccess: async () => {
      toast.success('Order status updated.');
      setNote('');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin', 'orders'] }),
        queryClient.invalidateQueries({ queryKey: adminQueryKeys.dashboard }),
      ]);
    },
  });
  const initiatePayment = useMutation({
    mutationFn: () => adminApi.initiateManualPayment(id),
    onSuccess: async () => {
      toast.success('Manual payment attempt initiated.');
      await queryClient.invalidateQueries({ queryKey: adminQueryKeys.orderPayments(id) });
    },
  });
  const createShipment = useMutation({
    mutationFn: () =>
      adminApi.createShipment(id, {
        courier: courier.trim(),
        ...(trackingNumber.trim() ? { trackingNumber: trackingNumber.trim() } : {}),
      }),
    onSuccess: (result) => {
      toast.success('Shipment created.');
      void navigate(`/admin/shipments/${result.shipment.id}`);
    },
  });
  const refreshPaymentData = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: adminQueryKeys.orderPayments(id) }),
      queryClient.invalidateQueries({ queryKey: adminQueryKeys.order(id) }),
      queryClient.invalidateQueries({ queryKey: ['admin', 'orders'] }),
      queryClient.invalidateQueries({ queryKey: ['admin', 'payments'] }),
      queryClient.invalidateQueries({ queryKey: adminQueryKeys.dashboard }),
    ]);
  };
  return (
    <>
      <Helmet>
        <title>Order management — Veyora Administration</title>
      </Helmet>
      <AdminPageHeader
        actions={
          <Link
            className="border-ink/15 rounded-xl border bg-white px-4 py-2 text-sm font-semibold"
            to="/admin/orders"
          >
            Back to orders
          </Link>
        }
        description="Review customer, shipping, item, total, and immutable status history information."
        eyebrow="Order details"
        title={order?.orderNumber ?? 'Order'}
      />
      <div className="mt-8">
        {orderQuery.isPending ? <AdminLoadingState rows={6} /> : null}
        {orderQuery.isError ? (
          <AdminErrorState
            message={getApiErrorMessage(orderQuery.error)}
            retry={() => void orderQuery.refetch()}
          />
        ) : null}
        {order ? (
          <>
            <section className="border-ink/10 rounded-2xl border bg-white p-5">
              <h2 className="font-display text-2xl">Customer</h2>
              <p className="mt-3 font-semibold">
                {order.customer.firstName} {order.customer.lastName}
              </p>
              <p className="text-ink/50 text-sm">{order.customer.email}</p>
            </section>
            <OrderDetails order={order} />
            <section className="border-ink/10 mt-8 rounded-2xl border bg-white p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="font-display text-2xl">Shipment</h2>
                  <p className="text-ink/50 mt-2 text-sm">
                    Fulfillment tracking begins after payment moves the order into processing.
                  </p>
                </div>
                {order.shipment ? (
                  <Link
                    className="bg-ink rounded-xl px-4 py-2.5 text-sm font-semibold text-white"
                    to={`/admin/shipments/${order.shipment.id}`}
                  >
                    Manage shipment
                  </Link>
                ) : null}
              </div>
              {order.shipment ? (
                <p className="text-ink/60 mt-5 text-sm">
                  {order.shipment.courier} · {order.shipment.trackingNumber ?? 'Tracking pending'} ·{' '}
                  {order.shipment.status.replaceAll('_', ' ')}
                </p>
              ) : order.status === 'PROCESSING' ? (
                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <label className="text-sm font-semibold">
                    Courier
                    <input
                      className="border-ink/15 mt-2 w-full rounded-xl border px-4 py-3 font-normal"
                      maxLength={120}
                      onChange={(event) => setCourier(event.target.value)}
                      placeholder="e.g. TCS"
                      value={courier}
                    />
                  </label>
                  <label className="text-sm font-semibold">
                    Tracking number{' '}
                    <span className="text-ink/40 font-normal">(optional until shipped)</span>
                    <input
                      className="border-ink/15 mt-2 w-full rounded-xl border px-4 py-3 font-normal"
                      maxLength={191}
                      onChange={(event) => setTrackingNumber(event.target.value)}
                      value={trackingNumber}
                    />
                  </label>
                  {createShipment.isError ? (
                    <p className="text-sm text-red-700 sm:col-span-2" role="alert">
                      {getApiErrorMessage(createShipment.error)}
                    </p>
                  ) : null}
                  <div className="sm:col-span-2">
                    <button
                      className="bg-ink rounded-xl px-5 py-3 text-sm font-semibold text-white disabled:opacity-40"
                      disabled={courier.trim().length < 2 || createShipment.isPending}
                      onClick={() => createShipment.mutate()}
                      type="button"
                    >
                      {createShipment.isPending ? 'Creating…' : 'Create shipment'}
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-ink/50 mt-5 text-sm">
                  No shipment has been created for this order.
                </p>
              )}
            </section>
            <section className="border-ink/10 mt-8 rounded-2xl border bg-white p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="font-display text-2xl">Payment attempts</h2>
                  <p className="text-ink/50 mt-2 text-sm">
                    Financial attempts are retained even after a failure or retry.
                  </p>
                </div>
                {order.status === 'AWAITING_PAYMENT' && !hasOpenPayment ? (
                  <button
                    className="bg-ink rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                    disabled={initiatePayment.isPending}
                    onClick={() => initiatePayment.mutate()}
                    type="button"
                  >
                    {initiatePayment.isPending ? 'Initiating…' : 'Initiate manual payment'}
                  </button>
                ) : null}
              </div>
              {initiatePayment.isError ? (
                <p className="mt-4 text-sm text-red-700" role="alert">
                  {getApiErrorMessage(initiatePayment.error)}
                </p>
              ) : null}
              {paymentQuery.isPending ? <AdminLoadingState rows={2} /> : null}
              {paymentQuery.isError ? (
                <AdminErrorState
                  message={getApiErrorMessage(paymentQuery.error)}
                  retry={() => void paymentQuery.refetch()}
                />
              ) : null}
              {payments.length ? (
                <div className="mt-5 space-y-4">
                  <PaymentHistory payments={payments} />
                  {payments.map((payment) => (
                    <ManualPaymentActions
                      key={`actions-${payment.id}`}
                      onSettled={refreshPaymentData}
                      payment={payment}
                    />
                  ))}
                </div>
              ) : null}
              {paymentQuery.isSuccess && payments.length === 0 ? (
                <p className="text-ink/50 mt-5 text-sm">No payment attempts recorded.</p>
              ) : null}
            </section>
            <div className="mt-8 grid gap-6 xl:grid-cols-2">
              <section className="border-ink/10 rounded-2xl border bg-white p-6">
                <h2 className="font-display text-2xl">Update status</h2>
                {available.length ? (
                  <div className="mt-5 space-y-4">
                    <label className="block text-sm font-semibold">
                      Next status
                      <select
                        className="border-ink/15 mt-2 w-full rounded-xl border px-4 py-3 font-normal"
                        onChange={(event) => setStatus(event.target.value as OrderStatus)}
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
                      Audit note <span className="text-ink/40 font-normal">(optional)</span>
                      <textarea
                        className="border-ink/15 mt-2 min-h-24 w-full rounded-xl border px-4 py-3 font-normal"
                        maxLength={500}
                        onChange={(event) => setNote(event.target.value)}
                        value={note}
                      />
                    </label>
                    {transition.isError ? (
                      <p className="text-sm text-red-700" role="alert">
                        {getApiErrorMessage(transition.error)}
                      </p>
                    ) : null}
                    <button
                      className="bg-ink rounded-xl px-5 py-3 text-sm font-semibold text-white disabled:opacity-40"
                      disabled={!selectedStatus || transition.isPending}
                      onClick={() =>
                        selectedStatus &&
                        transition.mutate({
                          status: selectedStatus,
                          ...(note.trim() ? { note: note.trim() } : {}),
                        })
                      }
                      type="button"
                    >
                      {transition.isPending ? 'Updating…' : 'Update status'}
                    </button>
                  </div>
                ) : (
                  <p className="text-ink/50 mt-3 text-sm">
                    This order is in a terminal state and has no available transitions.
                  </p>
                )}
              </section>
              <section className="border-ink/10 rounded-2xl border bg-white p-6">
                <h2 className="font-display text-2xl">Status history</h2>
                {order.statusHistory.length ? (
                  <ol className="mt-5 space-y-5">
                    {order.statusHistory.map((entry) => (
                      <li className="border-ink/10 border-l-2 pl-4" key={entry.id}>
                        <p className="font-semibold">
                          {entry.previousStatus.replaceAll('_', ' ')} →{' '}
                          {entry.newStatus.replaceAll('_', ' ')}
                        </p>
                        <p className="text-ink/45 mt-1 text-xs">
                          {formatDate(entry.createdAt)} ·{' '}
                          {entry.administrator
                            ? `${entry.administrator.firstName} ${entry.administrator.lastName}`
                            : (entry.systemActor ?? 'System')}
                        </p>
                        {entry.note ? (
                          <p className="text-ink/60 mt-2 text-sm">{entry.note}</p>
                        ) : null}
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="text-ink/50 mt-3 text-sm">No administrator status changes yet.</p>
                )}
              </section>
            </div>
          </>
        ) : null}
      </div>
    </>
  );
};
