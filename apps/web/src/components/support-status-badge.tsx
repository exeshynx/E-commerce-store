import type { SupportTicketStatus } from '@aurelia/contracts';

export const SupportStatusBadge = ({ status }: { status: SupportTicketStatus }) => {
  const tone =
    status === 'CLOSED' || status === 'RESOLVED'
      ? 'bg-emerald-100 text-emerald-800'
      : status === 'WAITING_CUSTOMER'
        ? 'bg-amber-100 text-amber-800'
        : 'bg-blue-100 text-blue-800';
  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold uppercase ${tone}`}>
      {status.replaceAll('_', ' ')}
    </span>
  );
};
