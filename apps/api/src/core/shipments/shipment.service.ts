import {
  AdminAuditAction,
  AdminAuditEntityType,
  EmailNotificationType,
  OrderStatus,
  ShipmentStatus,
} from '@prisma/client';
import type { Prisma } from '@prisma/client';
import { AppError } from '../../http/errors/app-error.js';
import { prisma } from '../../infrastructure/database/prisma.js';
import { recordAdminAudit, type AdminAuditContext } from '../audit/audit.service.js';
import { enqueueEmail } from '../notifications/email-queue.service.js';
import { transitionOrderStatus } from '../orders/order-status.service.js';
import type {
  AdminShipmentListQuery,
  ShipmentCreateInput,
  ShipmentEventCreateInput,
  ShipmentUpdateInput,
} from './shipment.schemas.js';

const shipmentTransitions: Record<ShipmentStatus, readonly ShipmentStatus[]> = {
  DELIVERED: [ShipmentStatus.RETURNED],
  OUT_FOR_DELIVERY: [ShipmentStatus.DELIVERED, ShipmentStatus.RETURNED],
  PACKING: [ShipmentStatus.READY_TO_SHIP],
  READY_TO_SHIP: [ShipmentStatus.SHIPPED],
  RETURNED: [],
  SHIPPED: [ShipmentStatus.OUT_FOR_DELIVERY, ShipmentStatus.DELIVERED, ShipmentStatus.RETURNED],
};

const shipmentInclude = {
  events: {
    include: {
      administrator: { select: { email: true, firstName: true, id: true, lastName: true } },
    },
    orderBy: [{ occurredAt: 'asc' as const }, { id: 'asc' as const }],
  },
  order: {
    select: {
      id: true,
      orderNumber: true,
      status: true,
      user: { select: { email: true, firstName: true, id: true, lastName: true } },
    },
  },
} satisfies Prisma.ShipmentInclude;

type ShipmentRow = Prisma.ShipmentGetPayload<{ include: typeof shipmentInclude }>;

const shipmentListSelect = {
  courier: true,
  createdAt: true,
  deliveredAt: true,
  id: true,
  order: shipmentInclude.order,
  orderId: true,
  shippedAt: true,
  status: true,
  trackingNumber: true,
  updatedAt: true,
} satisfies Prisma.ShipmentSelect;

type ShipmentListRow = Prisma.ShipmentGetPayload<{ select: typeof shipmentListSelect }>;

const serializeShipmentSummary = (shipment: ShipmentListRow) => ({
  ...shipment,
  createdAt: shipment.createdAt.toISOString(),
  deliveredAt: shipment.deliveredAt?.toISOString() ?? null,
  shippedAt: shipment.shippedAt?.toISOString() ?? null,
  updatedAt: shipment.updatedAt.toISOString(),
});

const serializeShipment = (shipment: ShipmentRow, includeAdministrator = true) => ({
  courier: shipment.courier,
  createdAt: shipment.createdAt.toISOString(),
  deliveredAt: shipment.deliveredAt?.toISOString() ?? null,
  events: shipment.events.map((event) => ({
    ...(includeAdministrator ? { administrator: event.administrator } : {}),
    createdAt: event.createdAt.toISOString(),
    id: event.id,
    location: event.location,
    message: event.message,
    occurredAt: event.occurredAt.toISOString(),
    previousStatus: event.previousStatus,
    status: event.status,
  })),
  id: shipment.id,
  order: shipment.order,
  orderId: shipment.orderId,
  shippedAt: shipment.shippedAt?.toISOString() ?? null,
  status: shipment.status,
  trackingNumber: shipment.trackingNumber,
  updatedAt: shipment.updatedAt.toISOString(),
});

const findShipment = (id: string) =>
  prisma.shipment.findUnique({ include: shipmentInclude, where: { id } });

const getShipmentOrThrow = async (id: string) => {
  const shipment = await findShipment(id);
  if (!shipment) throw new AppError(404, 'SHIPMENT_NOT_FOUND', 'The shipment does not exist.');
  return shipment;
};

const notificationPayload = (input: {
  courier: string;
  customerName: string;
  orderNumber: string;
  trackingNumber: string | null;
}) => ({
  courier: input.courier,
  customerName: input.customerName,
  orderNumber: input.orderNumber,
  trackingNumber: input.trackingNumber ?? 'Pending',
});

export const shipmentService = {
  create: async (orderId: string, input: ShipmentCreateInput, audit: AdminAuditContext) => {
    const shipmentId = await prisma.$transaction(async (transaction) => {
      const order = await transaction.order.findUnique({
        select: { id: true, status: true },
        where: { id: orderId },
      });
      if (!order) throw new AppError(404, 'ORDER_NOT_FOUND', 'The order does not exist.');
      if (order.status !== OrderStatus.PROCESSING) {
        throw new AppError(
          409,
          'ORDER_NOT_READY_FOR_FULFILLMENT',
          'Only processing orders can enter fulfillment.',
          { currentStatus: order.status },
        );
      }
      const existing = await transaction.shipment.findUnique({ where: { orderId } });
      if (existing) {
        throw new AppError(409, 'SHIPMENT_ALREADY_EXISTS', 'This order already has a shipment.');
      }
      const shipment = await transaction.shipment.create({
        data: {
          courier: input.courier,
          events: {
            create: {
              administratorId: audit.administratorId,
              message: 'Shipment created and packing started.',
              status: ShipmentStatus.PACKING,
            },
          },
          orderId,
          ...(input.trackingNumber ? { trackingNumber: input.trackingNumber } : {}),
        },
        select: { id: true },
      });
      await recordAdminAudit(transaction, audit, {
        action: AdminAuditAction.SHIPMENT_CREATED,
        entityId: shipment.id,
        entityType: AdminAuditEntityType.SHIPMENT,
        metadata: { courier: input.courier, orderId },
      });
      return shipment.id;
    });
    return { shipment: serializeShipment(await getShipmentOrThrow(shipmentId)) };
  },

  update: async (id: string, input: ShipmentUpdateInput, audit: AdminAuditContext) => {
    await prisma.$transaction(async (transaction) => {
      const shipment = await transaction.shipment.findUnique({ where: { id } });
      if (!shipment) throw new AppError(404, 'SHIPMENT_NOT_FOUND', 'The shipment does not exist.');
      if (
        input.trackingNumber === null &&
        shipment.status !== ShipmentStatus.PACKING &&
        shipment.status !== ShipmentStatus.READY_TO_SHIP
      ) {
        throw new AppError(
          409,
          'TRACKING_NUMBER_REQUIRED',
          'A shipped shipment must retain its tracking number.',
        );
      }
      await transaction.shipment.update({
        data: {
          ...(input.courier ? { courier: input.courier } : {}),
          ...(input.trackingNumber !== undefined ? { trackingNumber: input.trackingNumber } : {}),
        },
        where: { id },
      });
      await recordAdminAudit(transaction, audit, {
        action: AdminAuditAction.SHIPMENT_UPDATED,
        entityId: id,
        entityType: AdminAuditEntityType.SHIPMENT,
        metadata: input,
      });
    });
    return { shipment: serializeShipment(await getShipmentOrThrow(id)) };
  },

  addEvent: async (id: string, input: ShipmentEventCreateInput, audit: AdminAuditContext) => {
    await prisma.$transaction(async (transaction) => {
      await transaction.$queryRaw`SELECT id FROM shipments WHERE id = ${id} FOR UPDATE`;
      const shipment = await transaction.shipment.findUnique({
        include: {
          events: {
            orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
            select: { occurredAt: true },
            take: 1,
          },
          order: {
            include: { shippingAddress: true, user: true },
          },
        },
        where: { id },
      });
      if (!shipment) throw new AppError(404, 'SHIPMENT_NOT_FOUND', 'The shipment does not exist.');
      if (!shipmentTransitions[shipment.status].includes(input.status)) {
        throw new AppError(
          409,
          'INVALID_SHIPMENT_STATUS_TRANSITION',
          'That shipment status change is not allowed.',
          { allowedStatuses: shipmentTransitions[shipment.status], currentStatus: shipment.status },
        );
      }
      const requiresTracking: readonly ShipmentStatus[] = [
        ShipmentStatus.SHIPPED,
        ShipmentStatus.OUT_FOR_DELIVERY,
        ShipmentStatus.DELIVERED,
        ShipmentStatus.RETURNED,
      ];
      if (requiresTracking.includes(input.status) && !shipment.trackingNumber) {
        throw new AppError(
          409,
          'TRACKING_NUMBER_REQUIRED',
          'Add a tracking number before marking the shipment as shipped.',
        );
      }

      const occurredAt = input.occurredAt ?? new Date();
      const lastOccurredAt = shipment.events[0]?.occurredAt;
      if (lastOccurredAt && occurredAt < lastOccurredAt) {
        throw new AppError(
          409,
          'SHIPMENT_EVENT_TIME_INVALID',
          'A tracking event cannot occur before the current shipment status.',
          { lastOccurredAt: lastOccurredAt.toISOString() },
        );
      }
      await transaction.shipment.update({
        data: {
          ...(input.status === ShipmentStatus.SHIPPED && !shipment.shippedAt
            ? { shippedAt: occurredAt }
            : {}),
          ...(input.status === ShipmentStatus.DELIVERED ? { deliveredAt: occurredAt } : {}),
          status: input.status,
        },
        where: { id },
      });
      await transaction.shipmentEvent.create({
        data: {
          administratorId: audit.administratorId,
          ...(input.location ? { location: input.location } : {}),
          ...(input.message ? { message: input.message } : {}),
          occurredAt,
          previousStatus: shipment.status,
          shipmentId: id,
          status: input.status,
        },
      });

      if (
        input.status === ShipmentStatus.SHIPPED &&
        shipment.order.status === OrderStatus.PROCESSING
      ) {
        await transitionOrderStatus({
          actor: { id: audit.administratorId, type: 'ADMIN' },
          nextStatus: OrderStatus.SHIPPED,
          note: `Shipment ${id} was handed to ${shipment.courier}.`,
          orderId: shipment.orderId,
          source: 'SHIPMENT',
          transaction,
        });
      }
      if (
        input.status === ShipmentStatus.DELIVERED &&
        shipment.order.status === OrderStatus.SHIPPED
      ) {
        await transitionOrderStatus({
          actor: { id: audit.administratorId, type: 'ADMIN' },
          nextStatus: OrderStatus.DELIVERED,
          note: `Shipment ${id} was delivered.`,
          orderId: shipment.orderId,
          source: 'SHIPMENT',
          transaction,
        });
      }

      const recipientEmail = shipment.order.shippingAddress?.email ?? shipment.order.user.email;
      const payload = notificationPayload({
        courier: shipment.courier,
        customerName: `${shipment.order.user.firstName} ${shipment.order.user.lastName}`,
        orderNumber: shipment.order.orderNumber,
        trackingNumber: shipment.trackingNumber,
      });
      if (input.status === ShipmentStatus.SHIPPED) {
        await enqueueEmail(transaction, {
          deduplicationKey: `shipment:${id}:shipped`,
          notificationType: EmailNotificationType.SHIPMENT_NOTIFICATION,
          orderId: shipment.orderId,
          payload,
          recipientEmail,
          subject: `${shipment.order.orderNumber} has shipped`,
        });
      }
      if (input.status === ShipmentStatus.DELIVERED) {
        await enqueueEmail(transaction, {
          deduplicationKey: `shipment:${id}:delivered`,
          notificationType: EmailNotificationType.DELIVERY_CONFIRMATION,
          orderId: shipment.orderId,
          payload,
          recipientEmail,
          subject: `${shipment.order.orderNumber} was delivered`,
        });
      }
      await recordAdminAudit(transaction, audit, {
        action: AdminAuditAction.SHIPMENT_STATUS_CHANGED,
        entityId: id,
        entityType: AdminAuditEntityType.SHIPMENT,
        metadata: {
          from: shipment.status,
          orderId: shipment.orderId,
          to: input.status,
        },
      });
    });
    return { shipment: serializeShipment(await getShipmentOrThrow(id)) };
  },

  listAdmin: async (query: AdminShipmentListQuery) => {
    const where: Prisma.ShipmentWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.q
        ? {
            OR: [
              { courier: { contains: query.q } },
              { trackingNumber: { contains: query.q } },
              { order: { orderNumber: { contains: query.q } } },
              { order: { user: { email: { contains: query.q } } } },
            ],
          }
        : {}),
    };
    const skip = (query.page - 1) * query.pageSize;
    const [totalItems, shipments] = await prisma.$transaction([
      prisma.shipment.count({ where }),
      prisma.shipment.findMany({
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        select: shipmentListSelect,
        skip,
        take: query.pageSize,
        where,
      }),
    ]);
    return {
      items: shipments.map(serializeShipmentSummary),
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        totalItems,
        totalPages: Math.ceil(totalItems / query.pageSize),
      },
    };
  },

  getAdmin: async (id: string) => {
    const shipment = await getShipmentOrThrow(id);
    const notifications = await prisma.emailQueueItem.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        attempts: true,
        createdAt: true,
        id: true,
        lastError: true,
        notificationType: true,
        sentAt: true,
        status: true,
      },
      where: { orderId: shipment.orderId },
    });
    return {
      notifications: notifications.map((item) => ({
        ...item,
        createdAt: item.createdAt.toISOString(),
        sentAt: item.sentAt?.toISOString() ?? null,
      })),
      shipment: serializeShipment(shipment),
    };
  },

  getCustomerOrderTracking: async (userId: string, orderId: string) => {
    const order = await prisma.order.findFirst({
      select: {
        emailQueueItems: {
          orderBy: { createdAt: 'desc' },
          select: {
            createdAt: true,
            id: true,
            notificationType: true,
            sentAt: true,
            status: true,
          },
        },
        shipment: { include: shipmentInclude },
      },
      where: { id: orderId, userId },
    });
    if (!order) throw new AppError(404, 'ORDER_NOT_FOUND', 'The order does not exist.');
    return {
      notifications: order.emailQueueItems.map((item) => ({
        ...item,
        createdAt: item.createdAt.toISOString(),
        sentAt: item.sentAt?.toISOString() ?? null,
      })),
      shipment: order.shipment ? serializeShipment(order.shipment, false) : null,
    };
  },
};
