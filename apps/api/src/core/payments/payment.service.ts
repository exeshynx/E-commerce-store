import { randomUUID } from 'node:crypto';
import {
  OrderStatus,
  AdminAuditAction,
  AdminAuditEntityType,
  PaymentProvider,
  PaymentRefundStatus,
  PaymentStatus,
  Prisma,
} from '@prisma/client';
import { env } from '../../config/env.js';
import { AppError } from '../../http/errors/app-error.js';
import { prisma } from '../../infrastructure/database/prisma.js';
import { transitionOrderStatus } from '../orders/order-status.service.js';
import { enqueuePaymentSuccessEmail } from '../notifications/email-queue.service.js';
import { recordAdminAudit } from '../audit/audit.service.js';
import { synchronizeReturnRefundStatus } from '../returns/return-refund.service.js';
import { getPaymentProvider } from './payment-provider.registry.js';
import type {
  AdminPaymentListQuery,
  ManualPaymentStatusUpdateInput,
  PaymentRefundInput,
} from './payment.schemas.js';

const refundSelect = {
  amount: true,
  createdAt: true,
  currency: true,
  failureReason: true,
  id: true,
  paymentAttemptId: true,
  providerRefundId: true,
  reason: true,
  returnRequestId: true,
  status: true,
  updatedAt: true,
} satisfies Prisma.PaymentRefundSelect;

const paymentAttemptSelect = {
  amount: true,
  createdAt: true,
  currency: true,
  failureReason: true,
  id: true,
  orderId: true,
  provider: true,
  providerPaymentId: true,
  status: true,
  updatedAt: true,
} satisfies Prisma.PaymentAttemptSelect;

const paymentAttemptDetailSelect = {
  ...paymentAttemptSelect,
  refunds: {
    orderBy: [{ createdAt: 'desc' as const }, { id: 'desc' as const }],
    select: refundSelect,
  },
} satisfies Prisma.PaymentAttemptSelect;

type PaymentRow = Prisma.PaymentAttemptGetPayload<{ select: typeof paymentAttemptSelect }>;
type PaymentDetailRow = Prisma.PaymentAttemptGetPayload<{
  select: typeof paymentAttemptDetailSelect;
}>;
type RefundRow = Prisma.PaymentRefundGetPayload<{ select: typeof refundSelect }>;

const serializeRefund = (refund: RefundRow) => ({
  ...refund,
  amount: refund.amount.toFixed(2),
  createdAt: refund.createdAt.toISOString(),
  updatedAt: refund.updatedAt.toISOString(),
});

const serializePayment = (payment: PaymentRow | PaymentDetailRow) => ({
  ...payment,
  amount: payment.amount.toFixed(2),
  createdAt: payment.createdAt.toISOString(),
  ...('refunds' in payment ? { refunds: payment.refunds.map(serializeRefund) } : {}),
  updatedAt: payment.updatedAt.toISOString(),
});

const assertPayableOrder = (
  order: {
    paymentAttempts: Array<{ id: string; status: PaymentStatus }>;
    status: OrderStatus;
  },
  allowPending = false,
) => {
  if (order.paymentAttempts.some((payment) => payment.status === PaymentStatus.SUCCEEDED)) {
    throw new AppError(409, 'ORDER_ALREADY_PAID', 'This order already has a successful payment.');
  }
  if (order.paymentAttempts.length > 0) {
    throw new AppError(
      409,
      'PAYMENT_ATTEMPT_ACTIVE',
      'This order already has an active payment attempt.',
      { paymentAttemptId: order.paymentAttempts[0]?.id },
    );
  }
  if (
    order.status !== OrderStatus.AWAITING_PAYMENT &&
    !(allowPending && order.status === OrderStatus.PENDING)
  ) {
    throw new AppError(
      409,
      'ORDER_NOT_AWAITING_PAYMENT',
      'The order must be awaiting payment before a payment attempt can be initiated.',
      { currentStatus: order.status },
    );
  }
};

const payableOrderSelect = {
  currency: true,
  id: true,
  orderNumber: true,
  paymentAttempts: {
    select: { id: true, status: true },
    take: 1,
    where: {
      status: { in: [PaymentStatus.PENDING, PaymentStatus.PROCESSING, PaymentStatus.SUCCEEDED] },
    },
  },
  shippingAddress: { select: { email: true, fullName: true, phone: true } },
  status: true,
  total: true,
  user: { select: { email: true, firstName: true, id: true, lastName: true } },
} satisfies Prisma.OrderSelect;

const providerFailureReason = (error: unknown) =>
  error instanceof AppError ? error.message.slice(0, 500) : 'The payment provider request failed.';

const checkoutUrlFromMetadata = (metadata: unknown) => {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return null;
  const checkoutUrl = (metadata as Record<string, unknown>).checkoutUrl;
  return typeof checkoutUrl === 'string' ? checkoutUrl : null;
};

const createManualAttempt = async (orderId: string, actorId: string, ownerId?: string) => {
  const initialOrder = await prisma.order.findFirst({
    select: payableOrderSelect,
    where: { id: orderId, ...(ownerId ? { userId: ownerId } : {}) },
  });
  if (!initialOrder) throw new AppError(404, 'ORDER_NOT_FOUND', 'The order does not exist.');
  assertPayableOrder(initialOrder);

  const provider = getPaymentProvider(PaymentProvider.MANUAL);
  const idempotencyKey = `manual_${randomUUID()}`;
  const attemptId = randomUUID();
  const providerResult = await provider.createPaymentIntent({
    amount: initialOrder.total.toFixed(2),
    attemptId,
    cancelUrl: env.WEB_URL,
    currency: initialOrder.currency,
    customer: {
      email: initialOrder.shippingAddress?.email ?? initialOrder.user.email,
      firstName: initialOrder.shippingAddress?.fullName ?? initialOrder.user.firstName,
      lastName: initialOrder.shippingAddress ? '' : initialOrder.user.lastName,
      phone: initialOrder.shippingAddress?.phone ?? '',
    },
    idempotencyKey,
    orderId,
    orderNumber: initialOrder.orderNumber,
    returnUrl: env.WEB_URL,
  });

  const payment = await prisma.$transaction(async (transaction) => {
    await transaction.$queryRaw`
      SELECT id
      FROM orders
      WHERE id = ${orderId}
      FOR UPDATE
    `;
    const order = await transaction.order.findFirst({
      select: payableOrderSelect,
      where: { id: orderId, ...(ownerId ? { userId: ownerId } : {}) },
    });
    if (!order) throw new AppError(404, 'ORDER_NOT_FOUND', 'The order does not exist.');
    assertPayableOrder(order);

    return transaction.paymentAttempt.create({
      data: {
        amount: order.total,
        currency: order.currency,
        id: attemptId,
        metadata: {
          ...(providerResult.metadata ?? {}),
          initiatedByUserId: actorId,
        },
        orderId,
        provider: provider.provider,
        providerIdempotencyKey: idempotencyKey,
        providerPaymentId: providerResult.providerPaymentId,
        status: providerResult.status,
      },
      select: paymentAttemptSelect,
    });
  });

  return {
    checkoutUrl: null,
    orderStatus: initialOrder.status,
    payment: serializePayment(payment),
  };
};

const getSafepayReplay = async (userId: string, orderId: string, idempotencyKey: string) => {
  const existing = await prisma.paymentAttempt.findUnique({
    select: {
      ...paymentAttemptDetailSelect,
      metadata: true,
      order: { select: { status: true, userId: true } },
    },
    where: {
      provider_providerIdempotencyKey: {
        provider: PaymentProvider.SAFEPAY,
        providerIdempotencyKey: idempotencyKey,
      },
    },
  });
  if (!existing) return null;
  if (existing.order.userId !== userId || existing.orderId !== orderId) {
    throw new AppError(
      409,
      'PAYMENT_IDEMPOTENCY_KEY_REUSED',
      'That payment idempotency key has already been used.',
    );
  }
  const { metadata, order, ...payment } = existing;
  return {
    checkoutUrl: checkoutUrlFromMetadata(metadata),
    orderStatus: order.status,
    payment: serializePayment(payment),
  };
};

const createSafepayAttempt = async (userId: string, orderId: string, idempotencyKey: string) => {
  const replay = await getSafepayReplay(userId, orderId, idempotencyKey);
  if (replay) return replay;

  const attemptId = randomUUID();
  let order: Prisma.OrderGetPayload<{ select: typeof payableOrderSelect }>;
  try {
    order = await prisma.$transaction(async (transaction) => {
      await transaction.$queryRaw`
        SELECT id
        FROM orders
        WHERE id = ${orderId}
        FOR UPDATE
      `;
      const lockedOrder = await transaction.order.findFirst({
        select: payableOrderSelect,
        where: { id: orderId, userId },
      });
      if (!lockedOrder) throw new AppError(404, 'ORDER_NOT_FOUND', 'The order does not exist.');
      assertPayableOrder(lockedOrder, true);
      const payableOrder =
        lockedOrder.status === OrderStatus.PENDING
          ? {
              ...lockedOrder,
              status: (
                await transitionOrderStatus({
                  actor: { name: 'SAFEPAY_CHECKOUT', type: 'SYSTEM' },
                  nextStatus: OrderStatus.AWAITING_PAYMENT,
                  note: 'Customer initiated Safepay hosted checkout.',
                  orderId,
                  source: 'PAYMENT',
                  transaction,
                })
              ).status,
            }
          : lockedOrder;
      await transaction.paymentAttempt.create({
        data: {
          amount: payableOrder.total,
          currency: payableOrder.currency,
          id: attemptId,
          metadata: { initiatedByUserId: userId },
          orderId,
          provider: PaymentProvider.SAFEPAY,
          providerIdempotencyKey: idempotencyKey,
          status: PaymentStatus.PROCESSING,
        },
      });
      return payableOrder;
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const concurrentReplay = await getSafepayReplay(userId, orderId, idempotencyKey);
      if (concurrentReplay) return concurrentReplay;
    }
    throw error;
  }

  const provider = getPaymentProvider(PaymentProvider.SAFEPAY);
  try {
    const providerResult = await provider.createPaymentIntent({
      amount: order.total.toFixed(2),
      attemptId,
      cancelUrl: `${env.WEB_URL}/payments/safepay/return?orderId=${encodeURIComponent(orderId)}&cancelled=true`,
      currency: order.currency,
      customer: {
        email: order.shippingAddress?.email ?? order.user.email,
        firstName: order.shippingAddress?.fullName ?? order.user.firstName,
        lastName: order.shippingAddress ? '' : order.user.lastName,
        phone: order.shippingAddress?.phone ?? '',
      },
      idempotencyKey,
      orderId,
      orderNumber: order.orderNumber,
      returnUrl: `${env.WEB_URL}/payments/safepay/return?orderId=${encodeURIComponent(orderId)}`,
    });
    const stored = await prisma.paymentAttempt.update({
      data: {
        failureReason: null,
        metadata: {
          ...(providerResult.metadata ?? {}),
          ...(providerResult.checkoutUrl ? { checkoutUrl: providerResult.checkoutUrl } : {}),
          initiatedByUserId: userId,
        },
        providerPaymentId: providerResult.providerPaymentId,
        status: providerResult.status,
      },
      select: paymentAttemptDetailSelect,
      where: { id: attemptId },
    });
    return {
      checkoutUrl: providerResult.checkoutUrl,
      orderStatus: order.status,
      payment: serializePayment(stored),
    };
  } catch (error) {
    await prisma.paymentAttempt.updateMany({
      data: { failureReason: providerFailureReason(error), status: PaymentStatus.FAILED },
      where: { id: attemptId, status: PaymentStatus.PROCESSING },
    });
    throw error;
  }
};

const assertMutableManualAttempt = (payment: {
  provider: PaymentProvider;
  status: PaymentStatus;
}) => {
  if (payment.provider !== PaymentProvider.MANUAL) {
    throw new AppError(
      409,
      'PAYMENT_PROVIDER_STATUS_MANAGED_EXTERNALLY',
      'Only manual payment attempts can be settled through this endpoint.',
    );
  }
  if (payment.status !== PaymentStatus.PENDING && payment.status !== PaymentStatus.PROCESSING) {
    throw new AppError(
      409,
      'PAYMENT_ATTEMPT_FINALIZED',
      'This payment attempt is already in a final state.',
      { currentStatus: payment.status },
    );
  }
};

const createRefund = async (
  paymentId: string,
  administratorId: string,
  idempotencyKey: string,
  input: PaymentRefundInput,
  requestId?: string,
  association?: { returnRequestId: string },
) => {
  const amount = new Prisma.Decimal(input.amount);
  const existing = await prisma.paymentRefund.findUnique({
    select: refundSelect,
    where: { providerIdempotencyKey: idempotencyKey },
  });
  if (existing) {
    if (
      existing.paymentAttemptId !== paymentId ||
      existing.returnRequestId !== (association?.returnRequestId ?? null)
    ) {
      throw new AppError(
        409,
        'REFUND_IDEMPOTENCY_KEY_REUSED',
        'That refund idempotency key has already been used.',
      );
    }
    return { refund: serializeRefund(existing) };
  }

  const refundId = randomUUID();
  const payment = await prisma.$transaction(async (transaction) => {
    let linkedReturn:
      | {
          orderId: string;
          remainingAmount: Prisma.Decimal;
          status: 'INSPECTED' | 'REFUND_PENDING';
        }
      | undefined;
    if (association) {
      await transaction.$queryRaw`
        SELECT id
        FROM return_requests
        WHERE id = ${association.returnRequestId}
        FOR UPDATE
      `;
      const returnRequest = await transaction.returnRequest.findUnique({
        select: {
          items: { select: { refundAmount: true } },
          orderId: true,
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
          status: true,
        },
        where: { id: association.returnRequestId },
      });
      if (!returnRequest) {
        throw new AppError(404, 'RETURN_NOT_FOUND', 'The return request does not exist.');
      }
      if (!['INSPECTED', 'REFUND_PENDING'].includes(returnRequest.status)) {
        throw new AppError(
          409,
          'RETURN_NOT_REFUNDABLE',
          'The return must be inspected before a refund can be initiated.',
          { currentStatus: returnRequest.status },
        );
      }
      const expected = returnRequest.items.reduce(
        (total, item) => total.plus(item.refundAmount),
        new Prisma.Decimal(0),
      );
      const committed = returnRequest.refunds.reduce(
        (total, refund) => total.plus(refund.amount),
        new Prisma.Decimal(0),
      );
      const remainingAmount = expected.minus(committed);
      if (amount.gt(remainingAmount)) {
        throw new AppError(
          422,
          'RETURN_REFUND_AMOUNT_EXCEEDED',
          'The refund exceeds the amount remaining on this return.',
          { remainingAmount: remainingAmount.toFixed(2) },
        );
      }
      linkedReturn = {
        orderId: returnRequest.orderId,
        remainingAmount,
        status: returnRequest.status as 'INSPECTED' | 'REFUND_PENDING',
      };
    }
    await transaction.$queryRaw`
      SELECT id
      FROM payment_attempts
      WHERE id = ${paymentId}
      FOR UPDATE
    `;
    const storedPayment = await transaction.paymentAttempt.findUnique({
      select: {
        amount: true,
        currency: true,
        id: true,
        orderId: true,
        provider: true,
        providerPaymentId: true,
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
        status: true,
      },
      where: { id: paymentId },
    });
    if (!storedPayment) {
      throw new AppError(404, 'PAYMENT_ATTEMPT_NOT_FOUND', 'The payment attempt does not exist.');
    }
    if (linkedReturn && storedPayment.orderId !== linkedReturn.orderId) {
      throw new AppError(
        422,
        'RETURN_PAYMENT_INVALID',
        'The selected payment does not belong to the returned order.',
      );
    }
    if (storedPayment.status !== PaymentStatus.SUCCEEDED || !storedPayment.providerPaymentId) {
      throw new AppError(
        409,
        'PAYMENT_NOT_REFUNDABLE',
        'Only a successful provider payment can be refunded.',
      );
    }
    const refunded = storedPayment.refunds.reduce(
      (total, refund) => total.plus(refund.amount),
      new Prisma.Decimal(0),
    );
    if (amount.lte(0) || refunded.plus(amount).gt(storedPayment.amount)) {
      throw new AppError(
        422,
        'REFUND_AMOUNT_EXCEEDS_PAYMENT',
        'The refund exceeds the payment amount remaining.',
        { remainingAmount: storedPayment.amount.minus(refunded).toFixed(2) },
      );
    }
    await transaction.paymentRefund.create({
      data: {
        amount,
        currency: storedPayment.currency,
        id: refundId,
        metadata: { initiatedByAdministratorId: administratorId },
        paymentAttemptId: paymentId,
        providerIdempotencyKey: idempotencyKey,
        ...(input.reason ? { reason: input.reason } : {}),
        ...(association ? { returnRequestId: association.returnRequestId } : {}),
        status: PaymentRefundStatus.PROCESSING,
      },
    });
    await recordAdminAudit(
      transaction,
      { administratorId, ...(requestId ? { requestId } : {}) },
      {
        action: AdminAuditAction.PAYMENT_REFUND_CREATED,
        entityId: refundId,
        entityType: AdminAuditEntityType.PAYMENT_REFUND,
        metadata: {
          amount: amount.toFixed(2),
          currency: storedPayment.currency,
          paymentId,
        },
      },
    );
    if (association) {
      await transaction.returnRequest.updateMany({
        data: { status: 'REFUND_PENDING' },
        where: { id: association.returnRequestId, status: 'INSPECTED' },
      });
      await recordAdminAudit(
        transaction,
        { administratorId, ...(requestId ? { requestId } : {}) },
        {
          action: AdminAuditAction.RETURN_REFUND_INITIATED,
          entityId: association.returnRequestId,
          entityType: AdminAuditEntityType.RETURN_REQUEST,
          metadata: { amount: amount.toFixed(2), paymentId, refundId },
        },
      );
    }
    return storedPayment;
  });

  try {
    const result = await getPaymentProvider(payment.provider).refundPayment({
      amount: amount.toFixed(2),
      currency: payment.currency,
      idempotencyKey,
      providerPaymentId: payment.providerPaymentId as string,
      ...(input.reason ? { reason: input.reason } : {}),
    });
    const refund = await prisma.$transaction(async (transaction) => {
      const stored = await transaction.paymentRefund.update({
        data: {
          failureReason: null,
          metadata: {
            ...(result.metadata ?? {}),
            initiatedByAdministratorId: administratorId,
          },
          providerRefundId: result.providerRefundId,
          status: result.status,
        },
        select: refundSelect,
        where: { id: refundId },
      });
      await synchronizeReturnRefundStatus(transaction, stored.returnRequestId);
      return stored;
    });
    return { refund: serializeRefund(refund) };
  } catch (error) {
    await prisma.paymentRefund.updateMany({
      data: { failureReason: providerFailureReason(error), status: PaymentRefundStatus.FAILED },
      where: { id: refundId, status: PaymentRefundStatus.PROCESSING },
    });
    throw error;
  }
};

export const paymentService = {
  createCustomerManualAttempt: (userId: string, orderId: string) =>
    createManualAttempt(orderId, userId, userId),

  createCustomerSafepayAttempt: (userId: string, orderId: string, idempotencyKey: string) =>
    createSafepayAttempt(userId, orderId, idempotencyKey),

  createAdminManualAttempt: (administratorId: string, orderId: string) =>
    createManualAttempt(orderId, administratorId),

  createRefund,

  listCustomerOrderPayments: async (userId: string, orderId: string) => {
    const order = await prisma.order.findFirst({
      select: {
        paymentAttempts: {
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          select: paymentAttemptDetailSelect,
        },
      },
      where: { id: orderId, userId },
    });
    if (!order) throw new AppError(404, 'ORDER_NOT_FOUND', 'The order does not exist.');
    return { items: order.paymentAttempts.map(serializePayment) };
  },

  listAdminOrderPayments: async (orderId: string) => {
    const order = await prisma.order.findUnique({
      select: {
        paymentAttempts: {
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          select: paymentAttemptDetailSelect,
        },
      },
      where: { id: orderId },
    });
    if (!order) throw new AppError(404, 'ORDER_NOT_FOUND', 'The order does not exist.');
    return { items: order.paymentAttempts.map(serializePayment) };
  },

  getAdminPayment: async (paymentId: string) => {
    const payment = await prisma.paymentAttempt.findUnique({
      select: {
        ...paymentAttemptDetailSelect,
        order: {
          select: {
            id: true,
            orderNumber: true,
            status: true,
            user: { select: { email: true, firstName: true, id: true, lastName: true } },
          },
        },
        webhookEvents: {
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          select: {
            createdAt: true,
            eventType: true,
            externalEventId: true,
            id: true,
            lastError: true,
            processedAt: true,
            processingAttempts: true,
            processingStatus: true,
            providerCreatedAt: true,
            signatureVerified: true,
          },
          take: 100,
        },
      },
      where: { id: paymentId },
    });
    if (!payment) {
      throw new AppError(404, 'PAYMENT_ATTEMPT_NOT_FOUND', 'The payment attempt does not exist.');
    }
    const {
      order: { user, ...order },
      webhookEvents,
      ...attempt
    } = payment;
    return {
      payment: {
        ...serializePayment(attempt),
        order: { ...order, customer: user },
      },
      webhookEvents: webhookEvents.map((event) => ({
        ...event,
        createdAt: event.createdAt.toISOString(),
        processedAt: event.processedAt?.toISOString() ?? null,
        providerCreatedAt: event.providerCreatedAt?.toISOString() ?? null,
      })),
    };
  },

  listAdminPayments: async (query: AdminPaymentListQuery) => {
    const where: Prisma.PaymentAttemptWhereInput = {
      ...(query.provider ? { provider: query.provider } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.q
        ? {
            OR: [
              { providerPaymentId: { contains: query.q } },
              { order: { orderNumber: { contains: query.q } } },
              { order: { user: { email: { contains: query.q } } } },
            ],
          }
        : {}),
    };
    const skip = (query.page - 1) * query.pageSize;
    const [totalItems, payments] = await prisma.$transaction([
      prisma.paymentAttempt.count({ where }),
      prisma.paymentAttempt.findMany({
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        select: {
          ...paymentAttemptSelect,
          order: {
            select: {
              id: true,
              orderNumber: true,
              status: true,
              user: { select: { email: true, firstName: true, id: true, lastName: true } },
            },
          },
        },
        skip,
        take: query.pageSize,
        where,
      }),
    ]);

    return {
      items: payments.map(({ order: { user, ...order }, ...payment }) => ({
        ...serializePayment(payment),
        order: { ...order, customer: user },
      })),
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        totalItems,
        totalPages: Math.ceil(totalItems / query.pageSize),
      },
    };
  },

  updateManualPaymentStatus: async (
    paymentId: string,
    administratorId: string,
    input: ManualPaymentStatusUpdateInput,
  ) => {
    return prisma.$transaction(async (transaction) => {
      const payment = await transaction.paymentAttempt.findUnique({
        select: {
          ...paymentAttemptSelect,
          order: {
            select: { status: true },
          },
        },
        where: { id: paymentId },
      });
      if (!payment) {
        throw new AppError(404, 'PAYMENT_ATTEMPT_NOT_FOUND', 'The payment attempt does not exist.');
      }
      assertMutableManualAttempt(payment);

      if (input.status === PaymentStatus.SUCCEEDED) {
        await transitionOrderStatus({
          actor: { id: administratorId, type: 'ADMIN' },
          nextStatus: OrderStatus.PROCESSING,
          note: `Manual payment ${payment.id} succeeded.`,
          orderId: payment.orderId,
          source: 'PAYMENT',
          transaction,
        });
        await enqueuePaymentSuccessEmail(transaction, payment.id, payment.orderId);
      }

      const updated = await transaction.paymentAttempt.updateMany({
        data: {
          failureReason: input.status === PaymentStatus.FAILED ? input.failureReason : null,
          status: input.status,
        },
        where: {
          id: paymentId,
          status: { in: [PaymentStatus.PENDING, PaymentStatus.PROCESSING] },
        },
      });
      if (updated.count !== 1) {
        throw new AppError(
          409,
          'PAYMENT_STATUS_CONFLICT',
          'The payment status changed in another request. Refresh and try again.',
        );
      }

      const storedPayment = await transaction.paymentAttempt.findUniqueOrThrow({
        select: paymentAttemptDetailSelect,
        where: { id: paymentId },
      });
      return {
        checkoutUrl: null,
        orderStatus:
          input.status === PaymentStatus.SUCCEEDED ? OrderStatus.PROCESSING : payment.order.status,
        payment: serializePayment(storedPayment),
      };
    });
  },
};
