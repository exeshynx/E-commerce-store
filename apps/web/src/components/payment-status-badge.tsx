import type { PaymentStatus } from '@aurelia/contracts';

const labels: Record<PaymentStatus, string> = {
  CANCELLED: 'Cancelled',
  FAILED: 'Failed',
  PENDING: 'Pending',
  PROCESSING: 'Processing',
  REFUNDED: 'Refunded',
  SUCCEEDED: 'Succeeded',
};

const tones: Record<PaymentStatus, string> = {
  CANCELLED: 'bg-slate-100 text-slate-700',
  FAILED: 'bg-red-50 text-red-700',
  PENDING: 'bg-amber-50 text-amber-800',
  PROCESSING: 'bg-blue-50 text-blue-700',
  REFUNDED: 'bg-purple-50 text-purple-700',
  SUCCEEDED: 'bg-emerald-50 text-emerald-700',
};

export const PaymentStatusBadge = ({ status }: { status: PaymentStatus }) => (
  <span
    className={`inline-flex rounded-full px-3 py-1 text-[0.65rem] font-semibold tracking-[0.1em] uppercase ${tones[status]}`}
  >
    {labels[status]}
  </span>
);
