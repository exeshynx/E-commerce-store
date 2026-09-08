import type { ShipmentStatus } from '@aurelia/contracts';

const tones: Record<ShipmentStatus, string> = {
  DELIVERED: 'bg-emerald-100 text-emerald-800',
  OUT_FOR_DELIVERY: 'bg-blue-100 text-blue-800',
  PACKING: 'bg-stone-100 text-stone-700',
  READY_TO_SHIP: 'bg-amber-100 text-amber-800',
  RETURNED: 'bg-red-100 text-red-800',
  SHIPPED: 'bg-violet-100 text-violet-800',
};

export const ShipmentStatusBadge = ({ status }: { status: ShipmentStatus }) => (
  <span
    className={`inline-flex rounded-full px-3 py-1 text-[0.65rem] font-bold tracking-[0.08em] uppercase ${tones[status]}`}
  >
    {status.replaceAll('_', ' ')}
  </span>
);
