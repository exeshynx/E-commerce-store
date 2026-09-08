import type { ReturnStatus } from '@aurelia/contracts';

export const ReturnStatusBadge = ({ status }: { status: ReturnStatus }) => {
  const tone =
    status === 'REFUNDED' || status === 'CLOSED'
      ? 'bg-emerald-100 text-emerald-800'
      : status === 'REJECTED'
        ? 'bg-red-100 text-red-800'
        : status === 'REQUESTED' || status === 'REFUND_PENDING'
          ? 'bg-amber-100 text-amber-800'
          : 'bg-blue-100 text-blue-800';
  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold uppercase ${tone}`}>
      {status.replaceAll('_', ' ')}
    </span>
  );
};
