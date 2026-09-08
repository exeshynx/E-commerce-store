import type { PaymentAttempt } from '@veyora/contracts';
import { formatDate } from '../lib/format-date';
import { formatPrice } from '../lib/format-price';
import { PaymentStatusBadge } from './payment-status-badge';

export const PaymentHistory = ({ payments }: { payments: PaymentAttempt[] }) => (
  <div className="space-y-3">
    {payments.map((payment) => (
      <article className="border-ink/10 rounded-2xl border bg-white p-4" key={payment.id}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-semibold">{payment.provider.replaceAll('_', ' ')}</p>
            <p className="text-ink/45 mt-1 text-xs">
              {payment.providerPaymentId ?? payment.id} · {formatDate(payment.createdAt)}
            </p>
          </div>
          <PaymentStatusBadge status={payment.status} />
        </div>
        <p className="mt-3 text-sm font-semibold">
          {formatPrice(payment.amount, payment.currency)}
        </p>
        {payment.failureReason ? (
          <p className="mt-2 text-sm text-red-700">{payment.failureReason}</p>
        ) : null}
        {payment.refunds?.length ? (
          <div className="border-ink/10 mt-4 space-y-2 border-t pt-4">
            <p className="text-ink/45 text-xs font-semibold tracking-[0.1em] uppercase">Refunds</p>
            {payment.refunds.map((refund) => (
              <div
                className="flex flex-wrap items-center justify-between gap-3 text-sm"
                key={refund.id}
              >
                <div>
                  <p className="font-semibold">{formatPrice(refund.amount, refund.currency)}</p>
                  <p className="text-ink/45 text-xs">
                    {refund.reason ?? 'Refund'} · {formatDate(refund.createdAt)}
                  </p>
                </div>
                <span className="bg-mist rounded-full px-3 py-1 text-[0.65rem] font-semibold tracking-[0.1em] uppercase">
                  {refund.status.replaceAll('_', ' ')}
                </span>
              </div>
            ))}
          </div>
        ) : null}
      </article>
    ))}
  </div>
);
