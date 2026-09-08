import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { PaymentHistory } from '../../components/payment-history';
import { PaymentStatusBadge } from '../../components/payment-status-badge';
import { adminApi, adminQueryKeys } from '../../lib/admin-api';
import { getApiErrorMessage } from '../../lib/api-error';
import { formatDate } from '../../lib/format-date';
import { formatPrice } from '../../lib/format-price';
import {
  AdminErrorState,
  AdminLoadingState,
  AdminPageHeader,
  AdminTable,
  AdminTableHead,
} from '../components/admin-ui';

export const AdminPaymentDetailPage = () => {
  const { id = '' } = useParams();
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const paymentQuery = useQuery({
    enabled: Boolean(id),
    queryFn: () => adminApi.getPayment(id),
    queryKey: adminQueryKeys.payment(id),
  });
  const payment = paymentQuery.data?.payment;
  const webhookEvents = paymentQuery.data?.webhookEvents ?? [];
  const refunded =
    payment?.refunds
      .filter(
        (refund) =>
          refund.status === 'PENDING' ||
          refund.status === 'PROCESSING' ||
          refund.status === 'SUCCEEDED',
      )
      .reduce((total, refund) => total + Number(refund.amount), 0) ?? 0;
  const remaining = payment ? Math.max(Number(payment.amount) - refunded, 0) : 0;
  const refund = useMutation({
    mutationFn: () =>
      adminApi.refundPayment(
        id,
        { amount, ...(reason.trim() ? { reason: reason.trim() } : {}) },
        crypto.randomUUID(),
      ),
    onSuccess: async () => {
      toast.success('Refund request recorded.');
      setAmount('');
      setReason('');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: adminQueryKeys.payment(id) }),
        queryClient.invalidateQueries({ queryKey: ['admin', 'payments'] }),
      ]);
    },
  });

  return (
    <>
      <Helmet>
        <title>Payment details — Veyora Administration</title>
      </Helmet>
      <AdminPageHeader
        actions={
          <Link
            className="border-ink/15 rounded-xl border bg-white px-4 py-2 text-sm font-semibold"
            to="/admin/payments"
          >
            Back to payments
          </Link>
        }
        description="Inspect provider identity, signed webhook processing, and immutable refund history."
        eyebrow="Financial operations"
        title={payment?.providerPaymentId ?? 'Payment details'}
      />
      <div className="mt-8">
        {paymentQuery.isPending ? <AdminLoadingState rows={6} /> : null}
        {paymentQuery.isError ? (
          <AdminErrorState
            message={getApiErrorMessage(paymentQuery.error)}
            retry={() => void paymentQuery.refetch()}
          />
        ) : null}
        {payment ? (
          <div className="space-y-6">
            <section className="border-ink/10 grid gap-5 rounded-2xl border bg-white p-6 sm:grid-cols-2 xl:grid-cols-4">
              <div>
                <p className="text-ink/45 text-xs tracking-[0.12em] uppercase">Provider</p>
                <p className="mt-2 font-semibold">{payment.provider}</p>
              </div>
              <div>
                <p className="text-ink/45 text-xs tracking-[0.12em] uppercase">Status</p>
                <div className="mt-2">
                  <PaymentStatusBadge status={payment.status} />
                </div>
              </div>
              <div>
                <p className="text-ink/45 text-xs tracking-[0.12em] uppercase">Amount</p>
                <p className="mt-2 font-semibold">
                  {formatPrice(payment.amount, payment.currency)}
                </p>
              </div>
              <div>
                <p className="text-ink/45 text-xs tracking-[0.12em] uppercase">Order</p>
                <Link
                  className="mt-2 block font-semibold underline"
                  to={`/admin/orders/${payment.order.id}`}
                >
                  {payment.order.orderNumber}
                </Link>
              </div>
            </section>

            <section className="border-ink/10 rounded-2xl border bg-white p-6">
              <h2 className="font-display text-2xl">Payment and refund history</h2>
              <div className="mt-5">
                <PaymentHistory payments={[payment]} />
              </div>
            </section>

            {payment.provider === 'SAFEPAY' && payment.status === 'SUCCEEDED' && remaining > 0 ? (
              <section className="border-ink/10 rounded-2xl border bg-white p-6">
                <h2 className="font-display text-2xl">Create refund</h2>
                <p className="text-ink/50 mt-2 text-sm">
                  Remaining refundable amount: {formatPrice(remaining.toFixed(2), payment.currency)}
                </p>
                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <label className="text-sm font-semibold">
                    Amount
                    <input
                      className="border-ink/15 mt-2 w-full rounded-xl border px-4 py-3 font-normal"
                      inputMode="decimal"
                      onChange={(event) => setAmount(event.target.value)}
                      placeholder="2500.00"
                      value={amount}
                    />
                  </label>
                  <label className="text-sm font-semibold">
                    Reason <span className="text-ink/40 font-normal">(optional)</span>
                    <input
                      className="border-ink/15 mt-2 w-full rounded-xl border px-4 py-3 font-normal"
                      maxLength={500}
                      onChange={(event) => setReason(event.target.value)}
                      value={reason}
                    />
                  </label>
                </div>
                {refund.isError ? (
                  <p className="mt-4 text-sm text-red-700" role="alert">
                    {getApiErrorMessage(refund.error)}
                  </p>
                ) : null}
                <button
                  className="bg-ink mt-5 rounded-xl px-5 py-3 text-sm font-semibold text-white disabled:opacity-40"
                  disabled={!amount.trim() || refund.isPending}
                  onClick={() => refund.mutate()}
                  type="button"
                >
                  {refund.isPending ? 'Submitting refund…' : 'Submit refund'}
                </button>
              </section>
            ) : null}

            <section className="border-ink/10 rounded-2xl border bg-white p-6">
              <h2 className="font-display text-2xl">Webhook event history</h2>
              <p className="text-ink/50 mt-2 text-sm">
                Only signature-verified Safepay deliveries enter this trusted ledger.
              </p>
              {webhookEvents.length ? (
                <div className="mt-5">
                  <AdminTable ariaLabel="Webhook event history" minWidth="48rem">
                    <AdminTableHead>
                      <tr>
                        <th className="px-4 py-3">Event</th>
                        <th className="px-4 py-3">Processing</th>
                        <th className="px-4 py-3">Attempts</th>
                        <th className="px-4 py-3">Provider time</th>
                        <th className="px-4 py-3">Processed</th>
                      </tr>
                    </AdminTableHead>
                    <tbody className="divide-ink/10 divide-y">
                      {webhookEvents.map((event) => (
                        <tr key={event.id}>
                          <td className="px-4 py-4">
                            <p className="font-semibold">{event.eventType}</p>
                            <p className="text-ink/40 mt-1 max-w-60 truncate text-xs">
                              {event.externalEventId}
                            </p>
                          </td>
                          <td className="px-4 py-4">
                            <span className="bg-mist rounded-full px-3 py-1 text-xs font-semibold">
                              {event.processingStatus}
                            </span>
                            {event.lastError ? (
                              <p className="mt-2 max-w-64 text-xs text-red-700">
                                {event.lastError}
                              </p>
                            ) : null}
                          </td>
                          <td className="px-4 py-4">{event.processingAttempts}</td>
                          <td className="text-ink/55 px-4 py-4">
                            {event.providerCreatedAt
                              ? formatDate(event.providerCreatedAt)
                              : 'Not supplied'}
                          </td>
                          <td className="text-ink/55 px-4 py-4">
                            {event.processedAt ? formatDate(event.processedAt) : 'Pending'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </AdminTable>
                </div>
              ) : (
                <p className="text-ink/50 mt-5 text-sm">
                  No webhook deliveries are linked to this attempt.
                </p>
              )}
            </section>
          </div>
        ) : null}
      </div>
    </>
  );
};
