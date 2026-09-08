import { OrderStatus, OrderStatusActorType, type Prisma } from '@prisma/client';
import { AppError } from '../../http/errors/app-error.js';

type TransitionSource = 'ADMIN' | 'PAYMENT' | 'SHIPMENT';

const adminTransitions: Record<OrderStatus, readonly OrderStatus[]> = {
  AWAITING_PAYMENT: [OrderStatus.CANCELLED],
  CANCELLED: [],
  DELIVERED: [],
  PENDING: [OrderStatus.AWAITING_PAYMENT, OrderStatus.CANCELLED],
  PROCESSING: [OrderStatus.SHIPPED, OrderStatus.CANCELLED],
  SHIPPED: [OrderStatus.DELIVERED],
};

const paymentTransitions: Record<OrderStatus, readonly OrderStatus[]> = {
  AWAITING_PAYMENT: [OrderStatus.PROCESSING],
  CANCELLED: [],
  DELIVERED: [],
  PENDING: [OrderStatus.AWAITING_PAYMENT],
  PROCESSING: [],
  SHIPPED: [],
};

const shipmentOrderTransitions: Record<OrderStatus, readonly OrderStatus[]> = {
  AWAITING_PAYMENT: [],
  CANCELLED: [],
  DELIVERED: [],
  PENDING: [],
  PROCESSING: [OrderStatus.SHIPPED],
  SHIPPED: [OrderStatus.DELIVERED],
};

export const allowedAdminOrderTransitions = adminTransitions;

type TransitionOrderStatusInput = {
  actor: { id: string; type: 'ADMIN' } | { name: string; type: 'SYSTEM' };
  nextStatus: OrderStatus;
  note?: string;
  orderId: string;
  source: TransitionSource;
  transaction: Prisma.TransactionClient;
};

export const transitionOrderStatus = async ({
  actor,
  nextStatus,
  note,
  orderId,
  source,
  transaction,
}: TransitionOrderStatusInput) => {
  const order = await transaction.order.findUnique({
    select: { shipment: { select: { id: true } }, status: true },
    where: { id: orderId },
  });
  if (!order) throw new AppError(404, 'ORDER_NOT_FOUND', 'The order does not exist.');

  const allowedStatuses = (
    source === 'ADMIN'
      ? adminTransitions
      : source === 'PAYMENT'
        ? paymentTransitions
        : shipmentOrderTransitions
  )[order.status];
  if (
    source === 'ADMIN' &&
    order.shipment &&
    (nextStatus === OrderStatus.SHIPPED || nextStatus === OrderStatus.DELIVERED)
  ) {
    throw new AppError(
      409,
      'SHIPMENT_STATUS_REQUIRED',
      'Advance this order through its shipment tracking timeline.',
      { shipmentId: order.shipment.id },
    );
  }
  if (!allowedStatuses.includes(nextStatus)) {
    if (
      source === 'ADMIN' &&
      order.status === OrderStatus.AWAITING_PAYMENT &&
      nextStatus === OrderStatus.PROCESSING
    ) {
      throw new AppError(
        409,
        'ORDER_PAYMENT_REQUIRED',
        'A successful payment attempt is required before this order can begin processing.',
      );
    }
    throw new AppError(
      409,
      'INVALID_ORDER_STATUS_TRANSITION',
      'That status change is not allowed.',
      {
        allowedStatuses,
        currentStatus: order.status,
        requestedStatus: nextStatus,
      },
    );
  }

  const updated = await transaction.order.updateMany({
    data: { status: nextStatus },
    where: { id: orderId, status: order.status },
  });
  if (updated.count !== 1) {
    throw new AppError(
      409,
      'ORDER_STATUS_CONFLICT',
      'The order status changed in another request. Refresh and try again.',
    );
  }

  if (nextStatus === OrderStatus.CANCELLED) {
    await transaction.$executeRaw`
      UPDATE inventory AS inventory_record
      INNER JOIN order_items AS order_item
        ON order_item.product_id = inventory_record.product_id
      SET inventory_record.available_quantity = inventory_record.available_quantity + order_item.quantity,
          inventory_record.updated_at = CURRENT_TIMESTAMP(3)
      WHERE order_item.order_id = ${orderId}
    `;
  }

  await transaction.orderStatusHistory.create({
    data: {
      actorType: actor.type === 'ADMIN' ? OrderStatusActorType.ADMIN : OrderStatusActorType.SYSTEM,
      ...(actor.type === 'ADMIN' ? { administratorId: actor.id } : { systemActor: actor.name }),
      newStatus: nextStatus,
      ...(note ? { note } : {}),
      orderId,
      previousStatus: order.status,
    },
  });

  return { previousStatus: order.status, status: nextStatus };
};
