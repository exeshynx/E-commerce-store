import { randomUUID } from 'node:crypto';
import {
  AdminAuditAction,
  AdminAuditEntityType,
  EmailNotificationType,
  OrderStatus,
  PaymentRefundStatus,
  PaymentStatus,
  Prisma,
  ReturnShipmentStatus,
  ReturnStatus,
} from '@prisma/client';
import { env } from '../../config/env.js';
import { AppError } from '../../http/errors/app-error.js';
import { prisma } from '../../infrastructure/database/prisma.js';
import { recordAdminAudit, type AdminAuditContext } from '../audit/audit.service.js';
import { enqueueEmail } from '../notifications/email-queue.service.js';
import { paymentService } from '../payments/payment.service.js';
import type {
  AdminReturnListQuery,
  AdminReturnUpdateInput,
  ReturnCreateInput,
  ReturnListQuery,
} from './return.schemas.js';

const activeReturnStatuses: ReturnStatus[] = [
  ReturnStatus.REQUESTED,
  ReturnStatus.APPROVED,
  ReturnStatus.ITEM_RECEIVED,
  ReturnStatus.INSPECTED,
  ReturnStatus.REFUND_PENDING,
];

const returnShipmentTransitions: Record<ReturnShipmentStatus, ReturnShipmentStatus[]> = {
  AWAITING_SHIPMENT: [ReturnShipmentStatus.SHIPPED],
  SHIPPED: [
    ReturnShipmentStatus.IN_TRANSIT,
    ReturnShipmentStatus.DELIVERED,
    ReturnShipmentStatus.RETURNED_TO_SENDER,
  ],
  IN_TRANSIT: [ReturnShipmentStatus.DELIVERED, ReturnShipmentStatus.RETURNED_TO_SENDER],
  DELIVERED: [],
  RETURNED_TO_SENDER: [],
};

const returnInclude = {
  emailQueueItems: {
    orderBy: { createdAt: 'desc' as const },
    select: { createdAt: true, id: true, notificationType: true, sentAt: true, status: true },
  },
  items: { orderBy: { createdAt: 'asc' as const } },
  order: { select: { id: true, orderNumber: true, status: true } },
  refunds: {
    orderBy: { createdAt: 'desc' as const },
    select: {
      amount: true,
      createdAt: true,
      currency: true,
      failureReason: true,
      id: true,
      paymentAttemptId: true,
      providerRefundId: true,
      reason: true,
      status: true,
      updatedAt: true,
    },
  },
  shipment: {
    include: {
      events: {
        include: {
          administrator: { select: { email: true, firstName: true, id: true, lastName: true } },
        },
        orderBy: [{ occurredAt: 'asc' as const }, { id: 'asc' as const }],
      },
    },
  },
  user: { select: { email: true, firstName: true, id: true, lastName: true } },
} satisfies Prisma.ReturnRequestInclude;

type ReturnRecord = Prisma.ReturnRequestGetPayload<{ include: typeof returnInclude }>;

const returnSummarySelect = {
  createdAt: true,
  id: true,
  items: {
    orderBy: { createdAt: 'asc' as const },
    select: {
      createdAt: true,
      currency: true,
      id: true,
      orderItemId: true,
      productName: true,
      quantity: true,
      reason: true,
      reasonDetails: true,
      refundAmount: true,
      sku: true,
      unitPrice: true,
    },
  },
  order: { select: { id: true, orderNumber: true, status: true } },
  returnNumber: true,
  shipment: { select: { courier: true, id: true, status: true, trackingNumber: true } },
  status: true,
  updatedAt: true,
  user: { select: { email: true, firstName: true, id: true, lastName: true } },
} satisfies Prisma.ReturnRequestSelect;

type ReturnSummaryRecord = Prisma.ReturnRequestGetPayload<{ select: typeof returnSummarySelect }>;

const serializeReturnSummary = (request: ReturnSummaryRecord, includeCustomer = true) => ({
  createdAt: request.createdAt.toISOString(),
  ...(includeCustomer ? { customer: request.user } : {}),
  id: request.id,
  items: request.items.map((item) => ({
    ...item,
    createdAt: item.createdAt.toISOString(),
    refundAmount: item.refundAmount.toFixed(2),
    unitPrice: item.unitPrice.toFixed(2),
  })),
  order: request.order,
  returnNumber: request.returnNumber,
  shipment: request.shipment,
  status: request.status,
  updatedAt: request.updatedAt.toISOString(),
});

const serializeReturn = (request: ReturnRecord, includeCustomer = true) => ({
  approvedAt: request.approvedAt?.toISOString() ?? null,
  closedAt: request.closedAt?.toISOString() ?? null,
  createdAt: request.createdAt.toISOString(),
  customerNote: request.customerNote,
  ...(includeCustomer ? { customer: request.user } : {}),
  id: request.id,
  inspectedAt: request.inspectedAt?.toISOString() ?? null,
  inspectionNotes: request.inspectionNotes,
  items: request.items.map((item) => ({
    ...item,
    createdAt: item.createdAt.toISOString(),
    refundAmount: item.refundAmount.toFixed(2),
    unitPrice: item.unitPrice.toFixed(2),
  })),
  notifications: request.emailQueueItems.map((item) => ({
    ...item,
    createdAt: item.createdAt.toISOString(),
    sentAt: item.sentAt?.toISOString() ?? null,
  })),
  order: request.order,
  receivedAt: request.receivedAt?.toISOString() ?? null,
  refundedAt: request.refundedAt?.toISOString() ?? null,
  refunds: request.refunds.map((refund) => ({
    ...refund,
    amount: refund.amount.toFixed(2),
    createdAt: refund.createdAt.toISOString(),
    updatedAt: refund.updatedAt.toISOString(),
  })),
  rejectionReason: request.rejectionReason,
  returnNumber: request.returnNumber,
  shipment: request.shipment
    ? {
        ...request.shipment,
        createdAt: request.shipment.createdAt.toISOString(),
        deliveredAt: request.shipment.deliveredAt?.toISOString() ?? null,
        events: request.shipment.events.map((event) => ({
          ...event,
          createdAt: event.createdAt.toISOString(),
          occurredAt: event.occurredAt.toISOString(),
        })),
        shippedAt: request.shipment.shippedAt?.toISOString() ?? null,
        updatedAt: request.shipment.updatedAt.toISOString(),
      }
    : null,
  status: request.status,
  updatedAt: request.updatedAt.toISOString(),
});

const getReturnOrThrow = async (id: string, userId?: string) => {
  const request = await prisma.returnRequest.findFirst({
    include: returnInclude,
    where: { id, ...(userId ? { userId } : {}) },
  });
  if (!request) throw new AppError(404, 'RETURN_NOT_FOUND', 'The return request does not exist.');
  return request;
};

const createReturnNumber = () =>
  `RMA-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${randomUUID().replaceAll('-', '').slice(0, 10).toUpperCase()}`;

const assertStatus = (current: ReturnStatus, allowed: ReturnStatus[], action: string) => {
  if (!allowed.includes(current)) {
    throw new AppError(
      409,
      'RETURN_STATUS_TRANSITION_INVALID',
      `The return cannot be ${action} from its current status.`,
      {
        currentStatus: current,
      },
    );
  }
};

const updateStatus = async (
  id: string,
  input: Exclude<
    AdminReturnUpdateInput,
    { action: 'INITIATE_REFUND' | 'UPDATE_SHIPMENT' | 'ADD_SHIPMENT_EVENT' }
  >,
  audit: AdminAuditContext,
) => {
  await prisma.$transaction(async (transaction) => {
    await transaction.$queryRaw`SELECT id FROM return_requests WHERE id = ${id} FOR UPDATE`;
    const request = await transaction.returnRequest.findUnique({
      select: {
        orderId: true,
        returnNumber: true,
        status: true,
        user: { select: { email: true, firstName: true, lastName: true } },
      },
      where: { id },
    });
    if (!request) throw new AppError(404, 'RETURN_NOT_FOUND', 'The return request does not exist.');

    let nextStatus: ReturnStatus;
    let action: AdminAuditAction;
    let data: Prisma.ReturnRequestUpdateInput;
    if (input.action === 'APPROVE') {
      assertStatus(request.status, [ReturnStatus.REQUESTED], 'approved');
      nextStatus = ReturnStatus.APPROVED;
      action = AdminAuditAction.RETURN_APPROVED;
      data = { approvedAt: new Date(), rejectionReason: null };
    } else if (input.action === 'REJECT') {
      assertStatus(request.status, [ReturnStatus.REQUESTED], 'rejected');
      nextStatus = ReturnStatus.REJECTED;
      action = AdminAuditAction.RETURN_REJECTED;
      data = { rejectionReason: input.reason };
    } else if (input.action === 'RECEIVE_ITEM') {
      assertStatus(request.status, [ReturnStatus.APPROVED], 'received');
      nextStatus = ReturnStatus.ITEM_RECEIVED;
      action = AdminAuditAction.RETURN_ITEM_RECEIVED;
      data = { receivedAt: new Date() };
    } else if (input.action === 'INSPECT') {
      assertStatus(request.status, [ReturnStatus.ITEM_RECEIVED], 'inspected');
      nextStatus = ReturnStatus.INSPECTED;
      action = AdminAuditAction.RETURN_INSPECTED;
      data = { inspectedAt: new Date(), inspectionNotes: input.inspectionNotes };
    } else {
      assertStatus(request.status, [ReturnStatus.REJECTED, ReturnStatus.REFUNDED], 'closed');
      nextStatus = ReturnStatus.CLOSED;
      action = AdminAuditAction.RETURN_CLOSED;
      data = { closedAt: new Date() };
    }

    await transaction.returnRequest.update({
      data: { ...data, status: nextStatus },
      where: { id },
    });
    if (nextStatus === ReturnStatus.APPROVED || nextStatus === ReturnStatus.REJECTED) {
      await enqueueEmail(transaction, {
        deduplicationKey: `return:${id}:${nextStatus.toLowerCase()}`,
        notificationType:
          nextStatus === ReturnStatus.APPROVED
            ? EmailNotificationType.RETURN_APPROVED
            : EmailNotificationType.RETURN_REJECTED,
        orderId: request.orderId,
        payload: {
          customerName: `${request.user.firstName} ${request.user.lastName}`,
          ...(input.action === 'REJECT' ? { reason: input.reason } : {}),
          returnNumber: request.returnNumber,
        },
        recipientEmail: request.user.email,
        returnRequestId: id,
        subject: `Return ${request.returnNumber} ${nextStatus.toLowerCase()}`,
      });
    }
    await recordAdminAudit(transaction, audit, {
      action,
      entityId: id,
      entityType: AdminAuditEntityType.RETURN_REQUEST,
      metadata: {
        from: request.status,
        ...('note' in input && input.note ? { note: input.note } : {}),
        to: nextStatus,
      },
    });
  });
};

const updateShipment = async (
  id: string,
  input: Extract<AdminReturnUpdateInput, { action: 'UPDATE_SHIPMENT' | 'ADD_SHIPMENT_EVENT' }>,
  audit: AdminAuditContext,
) => {
  await prisma.$transaction(async (transaction) => {
    await transaction.$queryRaw`SELECT id FROM return_requests WHERE id = ${id} FOR UPDATE`;
    const request = await transaction.returnRequest.findUnique({
      include: { shipment: { include: { events: { orderBy: { occurredAt: 'desc' }, take: 1 } } } },
      where: { id },
    });
    if (!request) throw new AppError(404, 'RETURN_NOT_FOUND', 'The return request does not exist.');
    if (request.status === ReturnStatus.REJECTED || request.status === ReturnStatus.CLOSED) {
      throw new AppError(
        409,
        'RETURN_SHIPMENT_LOCKED',
        'Shipment details cannot be changed for this return.',
      );
    }
    const shipment =
      request.shipment ??
      (await transaction.returnShipment.create({
        data: { returnRequestId: id },
        include: { events: true },
      }));

    if (input.action === 'UPDATE_SHIPMENT') {
      await transaction.returnShipment.update({
        data: {
          ...(input.courier !== undefined ? { courier: input.courier } : {}),
          ...(input.trackingNumber !== undefined ? { trackingNumber: input.trackingNumber } : {}),
        },
        where: { id: shipment.id },
      });
      await recordAdminAudit(transaction, audit, {
        action: AdminAuditAction.RETURN_SHIPMENT_UPDATED,
        entityId: shipment.id,
        entityType: AdminAuditEntityType.RETURN_SHIPMENT,
        metadata: { returnRequestId: id },
      });
      return;
    }

    if (!returnShipmentTransitions[shipment.status].includes(input.status)) {
      throw new AppError(
        409,
        'RETURN_SHIPMENT_TRANSITION_INVALID',
        'That return shipment transition is not allowed.',
        {
          currentStatus: shipment.status,
          requestedStatus: input.status,
        },
      );
    }
    if (
      input.status !== ReturnShipmentStatus.AWAITING_SHIPMENT &&
      (!shipment.courier || !shipment.trackingNumber)
    ) {
      throw new AppError(
        409,
        'RETURN_TRACKING_REQUIRED',
        'Add a courier and tracking number first.',
      );
    }
    const occurredAt = input.occurredAt ?? new Date();
    const lastOccurredAt = shipment.events[0]?.occurredAt;
    if (lastOccurredAt && occurredAt < lastOccurredAt) {
      throw new AppError(
        409,
        'RETURN_SHIPMENT_EVENT_TIME_INVALID',
        'The event cannot predate the latest tracking event.',
      );
    }
    await transaction.returnShipment.update({
      data: {
        ...(input.status === ReturnShipmentStatus.SHIPPED && !shipment.shippedAt
          ? { shippedAt: occurredAt }
          : {}),
        ...(input.status === ReturnShipmentStatus.DELIVERED ? { deliveredAt: occurredAt } : {}),
        status: input.status,
      },
      where: { id: shipment.id },
    });
    await transaction.returnShipmentEvent.create({
      data: {
        administratorId: audit.administratorId,
        ...(input.location ? { location: input.location } : {}),
        ...(input.message ? { message: input.message } : {}),
        occurredAt,
        previousStatus: shipment.status,
        returnShipmentId: shipment.id,
        status: input.status,
      },
    });
    await recordAdminAudit(transaction, audit, {
      action: AdminAuditAction.RETURN_SHIPMENT_STATUS_CHANGED,
      entityId: shipment.id,
      entityType: AdminAuditEntityType.RETURN_SHIPMENT,
      metadata: { from: shipment.status, returnRequestId: id, to: input.status },
    });
  });
};

export const returnService = {
  create: async (userId: string, input: ReturnCreateInput) => {
    const result = await prisma.$transaction(
      async (transaction) => {
        await transaction.$queryRaw`SELECT id FROM orders WHERE id = ${input.orderId} FOR UPDATE`;
        const order = await transaction.order.findFirst({
          select: {
            currency: true,
            discountAmount: true,
            id: true,
            items: {
              orderBy: { id: 'asc' },
              select: {
                currency: true,
                id: true,
                lineSubtotal: true,
                productName: true,
                quantity: true,
                returnItems: {
                  select: {
                    quantity: true,
                    refundAmount: true,
                    returnRequest: { select: { rejectionReason: true, status: true } },
                  },
                },
                sku: true,
                unitPrice: true,
              },
            },
            orderNumber: true,
            subtotal: true,
            paymentAttempts: {
              select: {
                amount: true,
                refunds: {
                  select: { amount: true },
                  where: {
                    status: {
                      in: [
                        PaymentRefundStatus.PENDING,
                        PaymentRefundStatus.PROCESSING,
                        PaymentRefundStatus.SUCCEEDED,
                      ],
                    },
                  },
                },
              },
              where: { status: PaymentStatus.SUCCEEDED },
            },
            shipment: { select: { deliveredAt: true } },
            statusHistory: {
              orderBy: { createdAt: 'desc' },
              select: { createdAt: true },
              take: 1,
              where: { newStatus: OrderStatus.DELIVERED },
            },
            status: true,
            updatedAt: true,
            user: { select: { email: true, firstName: true, lastName: true } },
          },
          where: { id: input.orderId, userId },
        });
        if (!order) throw new AppError(404, 'ORDER_NOT_FOUND', 'The order does not exist.');
        if (order.status !== OrderStatus.DELIVERED) {
          throw new AppError(
            409,
            'RETURN_ORDER_NOT_DELIVERED',
            'Only delivered orders are eligible for return.',
          );
        }
        const deliveredAt =
          order.shipment?.deliveredAt ?? order.statusHistory[0]?.createdAt ?? order.updatedAt;
        const windowEndsAt = new Date(deliveredAt.getTime() + env.RETURN_WINDOW_DAYS * 86_400_000);
        if (new Date() > windowEndsAt) {
          throw new AppError(
            409,
            'RETURN_WINDOW_EXPIRED',
            `The ${env.RETURN_WINDOW_DAYS}-day return window has expired.`,
            {
              deliveredAt: deliveredAt.toISOString(),
              windowEndsAt: windowEndsAt.toISOString(),
            },
          );
        }

        // Allocate the immutable order-level discount across every line in a stable order.
        // This keeps return refunds inside the amount actually paid while preserving the
        // original unit price snapshot for historical display.
        const refundableByOrderItem = new Map<string, Prisma.Decimal>();
        let allocatedDiscount = new Prisma.Decimal(0);
        order.items.forEach((item, index) => {
          const isLastItem = index === order.items.length - 1;
          const itemDiscount = isLastItem
            ? order.discountAmount.minus(allocatedDiscount)
            : order.subtotal.gt(0)
              ? order.discountAmount.mul(item.lineSubtotal).div(order.subtotal).toDecimalPlaces(2)
              : new Prisma.Decimal(0);
          const boundedDiscount = Prisma.Decimal.min(itemDiscount, item.lineSubtotal);
          refundableByOrderItem.set(item.id, item.lineSubtotal.minus(boundedDiscount));
          allocatedDiscount = allocatedDiscount.plus(boundedDiscount);
        });

        const itemsById = new Map(order.items.map((item) => [item.id, item]));
        let requestedRefund = new Prisma.Decimal(0);
        const snapshots = input.items.map((requested) => {
          const item = itemsById.get(requested.orderItemId);
          if (!item)
            throw new AppError(
              422,
              'RETURN_ITEM_INVALID',
              'A requested item does not belong to this order.',
            );
          if (
            item.returnItems.some((existing) =>
              activeReturnStatuses.includes(existing.returnRequest.status),
            )
          ) {
            throw new AppError(
              409,
              'RETURN_ALREADY_ACTIVE',
              'An active return already exists for this order item.',
              {
                orderItemId: item.id,
              },
            );
          }
          const committedQuantity = item.returnItems
            .filter(
              (existing) =>
                existing.returnRequest.status !== ReturnStatus.REJECTED &&
                !(
                  existing.returnRequest.status === ReturnStatus.CLOSED &&
                  existing.returnRequest.rejectionReason
                ),
            )
            .reduce((total, existing) => total + existing.quantity, 0);
          const committedRefund = item.returnItems
            .filter(
              (existing) =>
                existing.returnRequest.status !== ReturnStatus.REJECTED &&
                !(
                  existing.returnRequest.status === ReturnStatus.CLOSED &&
                  existing.returnRequest.rejectionReason
                ),
            )
            .reduce((total, existing) => total.plus(existing.refundAmount), new Prisma.Decimal(0));
          const remainingQuantity = item.quantity - committedQuantity;
          if (requested.quantity > remainingQuantity) {
            throw new AppError(
              422,
              'RETURN_QUANTITY_EXCEEDED',
              'The return quantity exceeds the eligible quantity.',
              {
                orderItemId: item.id,
                remainingQuantity,
              },
            );
          }
          const refundableTotal = refundableByOrderItem.get(item.id) ?? item.lineSubtotal;
          const refundableBalance = Prisma.Decimal.max(
            refundableTotal.minus(committedRefund),
            new Prisma.Decimal(0),
          );
          const proportionalAmount = refundableTotal
            .mul(requested.quantity)
            .div(item.quantity)
            .toDecimalPlaces(2);
          const refundAmount =
            requested.quantity === remainingQuantity
              ? refundableBalance
              : Prisma.Decimal.min(proportionalAmount, refundableBalance);
          requestedRefund = requestedRefund.plus(refundAmount);
          return {
            currency: item.currency,
            orderItemId: item.id,
            productName: item.productName,
            quantity: requested.quantity,
            reason: requested.reason,
            ...(requested.reasonDetails ? { reasonDetails: requested.reasonDetails } : {}),
            refundAmount,
            sku: item.sku,
            unitPrice: item.unitPrice,
          };
        });
        const paid = order.paymentAttempts.reduce(
          (total, payment) => total.plus(payment.amount),
          new Prisma.Decimal(0),
        );
        const alreadyRefunded = order.paymentAttempts
          .flatMap((payment) => payment.refunds)
          .reduce((total, refund) => total.plus(refund.amount), new Prisma.Decimal(0));
        if (requestedRefund.gt(paid.minus(alreadyRefunded))) {
          throw new AppError(
            409,
            'RETURN_REFUND_NOT_AVAILABLE',
            'The requested items exceed the refundable payment balance.',
          );
        }

        const created = await transaction.returnRequest.create({
          data: {
            ...(input.customerNote ? { customerNote: input.customerNote } : {}),
            items: { create: snapshots },
            orderId: order.id,
            returnNumber: createReturnNumber(),
            shipment: { create: {} },
            userId,
          },
          include: returnInclude,
        });
        await enqueueEmail(transaction, {
          deduplicationKey: `return:${created.id}:requested`,
          notificationType: EmailNotificationType.RETURN_REQUESTED,
          orderId: order.id,
          payload: {
            customerName: `${order.user.firstName} ${order.user.lastName}`,
            orderNumber: order.orderNumber,
            returnNumber: created.returnNumber,
          },
          recipientEmail: order.user.email,
          returnRequestId: created.id,
          subject: `Return ${created.returnNumber} received`,
        });
        return created;
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 5_000,
        timeout: 20_000,
      },
    );
    return { returnRequest: serializeReturn(result, false) };
  },

  listCustomer: async (userId: string, query: ReturnListQuery) => {
    const skip = (query.page - 1) * query.pageSize;
    const [totalItems, items] = await prisma.$transaction([
      prisma.returnRequest.count({ where: { userId } }),
      prisma.returnRequest.findMany({
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        select: returnSummarySelect,
        skip,
        take: query.pageSize,
        where: { userId },
      }),
    ]);
    return {
      items: items.map((item) => serializeReturnSummary(item, false)),
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        totalItems,
        totalPages: Math.ceil(totalItems / query.pageSize),
      },
    };
  },

  getCustomer: async (userId: string, id: string) => ({
    returnRequest: serializeReturn(await getReturnOrThrow(id, userId), false),
  }),

  listAdmin: async (query: AdminReturnListQuery) => {
    const where: Prisma.ReturnRequestWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.q
        ? {
            OR: [
              { returnNumber: { contains: query.q } },
              { order: { orderNumber: { contains: query.q } } },
              { user: { email: { contains: query.q } } },
            ],
          }
        : {}),
    };
    const skip = (query.page - 1) * query.pageSize;
    const [totalItems, items] = await prisma.$transaction([
      prisma.returnRequest.count({ where }),
      prisma.returnRequest.findMany({
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        select: returnSummarySelect,
        skip,
        take: query.pageSize,
        where,
      }),
    ]);
    return {
      items: items.map((item) => serializeReturnSummary(item)),
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        totalItems,
        totalPages: Math.ceil(totalItems / query.pageSize),
      },
    };
  },

  getAdmin: async (id: string) => ({ returnRequest: serializeReturn(await getReturnOrThrow(id)) }),

  updateAdmin: async (id: string, input: AdminReturnUpdateInput, audit: AdminAuditContext) => {
    if (input.action === 'INITIATE_REFUND') {
      await paymentService.createRefund(
        input.paymentAttemptId,
        audit.administratorId,
        input.idempotencyKey,
        { amount: input.amount, reason: input.reason ?? `Return ${id}` },
        audit.requestId,
        { returnRequestId: id },
      );
    } else if (input.action === 'UPDATE_SHIPMENT' || input.action === 'ADD_SHIPMENT_EVENT') {
      await updateShipment(id, input, audit);
    } else {
      await updateStatus(id, input, audit);
    }
    return { returnRequest: serializeReturn(await getReturnOrThrow(id)) };
  },
};
