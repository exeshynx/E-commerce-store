import type { AdminReturnUpdateRequest, ReturnShipmentStatus } from '@veyora/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link, useParams } from 'react-router-dom';
import { ReturnStatusBadge } from '../../components/return-status-badge';
import { adminApi, adminQueryKeys } from '../../lib/admin-api';
import { getApiErrorMessage } from '../../lib/api-error';
import { formatDate } from '../../lib/format-date';
import { formatPrice } from '../../lib/format-price';
import {
  AdminBadge,
  AdminErrorState,
  AdminLoadingState,
  AdminPageHeader,
} from '../components/admin-ui';

const shipmentTransitions: Record<ReturnShipmentStatus, ReturnShipmentStatus[]> = {
  AWAITING_SHIPMENT: ['SHIPPED'],
  SHIPPED: ['IN_TRANSIT', 'DELIVERED', 'RETURNED_TO_SENDER'],
  IN_TRANSIT: ['DELIVERED', 'RETURNED_TO_SENDER'],
  DELIVERED: [],
  RETURNED_TO_SENDER: [],
};

export const AdminReturnDetailPage = () => {
  const { id = '' } = useParams();
  const queryClient = useQueryClient();
  const [notes, setNotes] = useState('');
  const [refundAmount, setRefundAmount] = useState('');
  const [paymentId, setPaymentId] = useState('');
  const [courier, setCourier] = useState<string>();
  const [tracking, setTracking] = useState<string>();
  const [shipmentStatus, setShipmentStatus] = useState<ReturnShipmentStatus | ''>('');
  const query = useQuery({
    enabled: Boolean(id),
    queryFn: () => adminApi.getReturn(id),
    queryKey: adminQueryKeys.returnRequest(id),
  });
  const request = query.data?.returnRequest;
  const payments = useQuery({
    enabled: Boolean(request?.order.id),
    queryFn: () => adminApi.getOrderPayments(request?.order.id ?? ''),
    queryKey: adminQueryKeys.orderPayments(request?.order.id ?? ''),
  });
  const update = useMutation({
    mutationFn: (input: AdminReturnUpdateRequest) => adminApi.updateReturn(id, input),
    onSuccess: (data) => {
      queryClient.setQueryData(adminQueryKeys.returnRequest(id), data);
      void queryClient.invalidateQueries({ queryKey: ['admin', 'returns'] });
      setNotes('');
      setCourier(undefined);
      setTracking(undefined);
    },
  });
  const submitShipment = (event: FormEvent) => {
    event.preventDefault();
    update.mutate({
      action: 'UPDATE_SHIPMENT',
      ...(courier !== undefined ? { courier: courier || null } : {}),
      ...(tracking !== undefined ? { trackingNumber: tracking || null } : {}),
    });
  };
  const expected = request?.items.reduce((sum, item) => sum + Number(item.refundAmount), 0) ?? 0;
  const committed =
    request?.refunds
      .filter((item) => ['PENDING', 'PROCESSING', 'SUCCEEDED'].includes(item.status))
      .reduce((sum, item) => sum + Number(item.amount), 0) ?? 0;
  return (
    <>
      <Helmet>
        <title>Return details — Veyora Administration</title>
      </Helmet>
      <Link className="text-sm underline" to="/admin/returns">
        ← Returns
      </Link>
      {query.isPending ? (
        <div className="mt-6">
          <AdminLoadingState />
        </div>
      ) : null}
      {query.isError ? (
        <div className="mt-6">
          <AdminErrorState message={getApiErrorMessage(query.error)} />
        </div>
      ) : null}
      {request ? (
        <div className="mt-6 space-y-7">
          <AdminPageHeader
            description={`Order ${request.order.orderNumber} · Requested ${formatDate(request.createdAt)}`}
            eyebrow="Return authorization"
            title={request.returnNumber}
            actions={<ReturnStatusBadge status={request.status} />}
          />
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_23rem]">
            <div className="space-y-6">
              <section className="border-ink/10 rounded-2xl border bg-white p-6">
                <h2 className="font-display text-2xl">Items and snapshots</h2>
                <div className="mt-5 space-y-4">
                  {request.items.map((item) => (
                    <article className="bg-mist rounded-xl p-4" key={item.id}>
                      <div className="flex flex-wrap justify-between gap-3">
                        <div>
                          <p className="font-semibold">{item.productName}</p>
                          <p className="text-ink/50 text-sm">
                            {item.sku} · Qty {item.quantity} · {item.reason.replaceAll('_', ' ')}
                          </p>
                        </div>
                        <p className="font-semibold">
                          {formatPrice(item.refundAmount, item.currency)}
                        </p>
                      </div>
                      {item.reasonDetails ? (
                        <p className="text-ink/60 mt-2 text-sm">{item.reasonDetails}</p>
                      ) : null}
                    </article>
                  ))}
                </div>
                {request.inspectionNotes ? (
                  <p className="mt-5 rounded-xl bg-blue-50 p-4 text-sm">
                    Inspection: {request.inspectionNotes}
                  </p>
                ) : null}
                {request.rejectionReason ? (
                  <p className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-800">
                    Rejected: {request.rejectionReason}
                  </p>
                ) : null}
              </section>
              <section className="border-ink/10 rounded-2xl border bg-white p-6">
                <h2 className="font-display text-2xl">Return shipment</h2>
                <form className="mt-5 grid gap-4 sm:grid-cols-2" onSubmit={submitShipment}>
                  <label className="text-sm font-semibold">
                    Courier
                    <input
                      className="mt-2 w-full rounded-xl border px-4 py-3 font-normal"
                      onChange={(event) => setCourier(event.target.value)}
                      placeholder={request.shipment?.courier ?? 'Courier'}
                      value={courier ?? request.shipment?.courier ?? ''}
                    />
                  </label>
                  <label className="text-sm font-semibold">
                    Tracking number
                    <input
                      className="mt-2 w-full rounded-xl border px-4 py-3 font-normal"
                      onChange={(event) => setTracking(event.target.value)}
                      placeholder={request.shipment?.trackingNumber ?? 'Tracking number'}
                      value={tracking ?? request.shipment?.trackingNumber ?? ''}
                    />
                  </label>
                  <button
                    className="bg-ink rounded-xl px-5 py-3 text-sm font-semibold text-white sm:col-span-2"
                    disabled={(courier === undefined && tracking === undefined) || update.isPending}
                  >
                    Save return tracking
                  </button>
                </form>
                {request.shipment ? (
                  <div className="mt-6">
                    <div className="flex flex-wrap items-center gap-3">
                      <AdminBadge>{request.shipment.status.replaceAll('_', ' ')}</AdminBadge>
                      <select
                        className="rounded-xl border px-3 py-2 text-sm"
                        onChange={(event) =>
                          setShipmentStatus(event.target.value as ReturnShipmentStatus)
                        }
                        value={shipmentStatus}
                      >
                        <option value="">Next status</option>
                        {shipmentTransitions[request.shipment.status].map((status) => (
                          <option key={status}>{status}</option>
                        ))}
                      </select>
                      <button
                        className="rounded-xl border px-4 py-2 text-sm font-semibold disabled:opacity-40"
                        disabled={!shipmentStatus || update.isPending}
                        onClick={() =>
                          shipmentStatus &&
                          update.mutate({ action: 'ADD_SHIPMENT_EVENT', status: shipmentStatus })
                        }
                      >
                        Record event
                      </button>
                    </div>
                    <ol className="mt-5 space-y-3">
                      {[...request.shipment.events].reverse().map((event) => (
                        <li className="border-l-2 pl-4 text-sm" key={event.id}>
                          <p className="font-semibold">{event.status.replaceAll('_', ' ')}</p>
                          <p className="text-ink/45 text-xs">{formatDate(event.occurredAt)}</p>
                        </li>
                      ))}
                    </ol>
                  </div>
                ) : null}
              </section>
            </div>
            <aside className="space-y-5">
              <section className="border-ink/10 rounded-2xl border bg-white p-5">
                <h2 className="font-display text-2xl">Actions</h2>
                <textarea
                  className="mt-4 min-h-24 w-full rounded-xl border px-3 py-2 text-sm"
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Required inspection or rejection notes"
                  value={notes}
                />
                {request.status === 'REQUESTED' ? (
                  <div className="mt-4 grid gap-2">
                    <button
                      className="rounded-xl bg-emerald-700 px-4 py-3 text-sm font-semibold text-white"
                      onClick={() =>
                        update.mutate({ action: 'APPROVE', ...(notes ? { note: notes } : {}) })
                      }
                    >
                      Approve
                    </button>
                    <button
                      className="rounded-xl bg-red-700 px-4 py-3 text-sm font-semibold text-white disabled:opacity-40"
                      disabled={!notes.trim()}
                      onClick={() => update.mutate({ action: 'REJECT', reason: notes })}
                    >
                      Reject
                    </button>
                  </div>
                ) : null}
                {request.status === 'APPROVED' ? (
                  <button
                    className="bg-ink mt-4 w-full rounded-xl px-4 py-3 text-sm font-semibold text-white"
                    onClick={() =>
                      update.mutate({ action: 'RECEIVE_ITEM', ...(notes ? { note: notes } : {}) })
                    }
                  >
                    Receive item
                  </button>
                ) : null}
                {request.status === 'ITEM_RECEIVED' ? (
                  <button
                    className="bg-ink mt-4 w-full rounded-xl px-4 py-3 text-sm font-semibold text-white disabled:opacity-40"
                    disabled={!notes.trim()}
                    onClick={() => update.mutate({ action: 'INSPECT', inspectionNotes: notes })}
                  >
                    Complete inspection
                  </button>
                ) : null}
                {request.status === 'REFUNDED' || request.status === 'REJECTED' ? (
                  <button
                    className="bg-ink mt-4 w-full rounded-xl px-4 py-3 text-sm font-semibold text-white"
                    onClick={() =>
                      update.mutate({ action: 'CLOSE', ...(notes ? { note: notes } : {}) })
                    }
                  >
                    Close return
                  </button>
                ) : null}
                {update.isError ? (
                  <p className="mt-4 text-sm text-red-700">{getApiErrorMessage(update.error)}</p>
                ) : null}
              </section>
              {request.status === 'INSPECTED' || request.status === 'REFUND_PENDING' ? (
                <section className="border-ink/10 rounded-2xl border bg-white p-5">
                  <h2 className="font-display text-2xl">Refund</h2>
                  <p className="text-ink/50 mt-2 text-sm">
                    Remaining{' '}
                    {formatPrice(
                      String(Math.max(0, expected - committed)),
                      request.items[0]?.currency ?? 'PKR',
                    )}
                  </p>
                  <select
                    className="mt-4 w-full rounded-xl border px-3 py-2 text-sm"
                    onChange={(event) => setPaymentId(event.target.value)}
                    value={paymentId}
                  >
                    <option value="">Successful payment</option>
                    {payments.data?.items
                      .filter((item) => item.status === 'SUCCEEDED')
                      .map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.provider} · {item.amount} {item.currency}
                        </option>
                      ))}
                  </select>
                  <input
                    className="mt-3 w-full rounded-xl border px-3 py-2"
                    onChange={(event) => setRefundAmount(event.target.value)}
                    placeholder="Refund amount"
                    value={refundAmount}
                  />
                  <button
                    className="bg-ink mt-3 w-full rounded-xl px-4 py-3 text-sm font-semibold text-white disabled:opacity-40"
                    disabled={!paymentId || !refundAmount || update.isPending}
                    onClick={() =>
                      update.mutate({
                        action: 'INITIATE_REFUND',
                        amount: refundAmount,
                        idempotencyKey: `rma_${id}_${crypto.randomUUID()}`,
                        paymentAttemptId: paymentId,
                        reason: `Approved return ${request.returnNumber}`,
                      })
                    }
                  >
                    Initiate partial refund
                  </button>
                </section>
              ) : null}
              <section className="border-ink/10 rounded-2xl border bg-white p-5">
                <h2 className="font-display text-2xl">Refund history</h2>
                {request.refunds.length ? (
                  <ul className="mt-4 space-y-3">
                    {request.refunds.map((refund) => (
                      <li className="bg-mist rounded-xl p-3 text-sm" key={refund.id}>
                        <div className="flex justify-between">
                          <span>{formatPrice(refund.amount, refund.currency)}</span>
                          <AdminBadge
                            tone={
                              refund.status === 'SUCCEEDED'
                                ? 'good'
                                : refund.status === 'FAILED'
                                  ? 'danger'
                                  : 'warning'
                            }
                          >
                            {refund.status}
                          </AdminBadge>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-ink/50 mt-3 text-sm">No refunds.</p>
                )}
              </section>
            </aside>
          </div>
        </div>
      ) : null}
    </>
  );
};
