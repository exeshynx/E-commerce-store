import type { OrderStatus } from '@aurelia/contracts';

const labels: Record<OrderStatus, string> = {
  AWAITING_PAYMENT: 'Awaiting payment',
  CANCELLED: 'Cancelled',
  DELIVERED: 'Delivered',
  PENDING: 'Pending',
  PROCESSING: 'Processing',
  SHIPPED: 'Shipped',
};

export const OrderStatusBadge = ({ status }: { status: OrderStatus }) => (
  <span className="bg-champagne/15 text-ink inline-flex rounded-full px-3 py-1 text-[0.65rem] font-semibold tracking-[0.12em] uppercase">
    {labels[status]}
  </span>
);
