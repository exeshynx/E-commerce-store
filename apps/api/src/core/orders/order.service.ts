import { createHash, randomUUID } from 'node:crypto';
import { EmailNotificationType, Prisma } from '@prisma/client';
import { prisma } from '../../infrastructure/database/prisma.js';
import { AppError } from '../../http/errors/app-error.js';
import { enqueueEmail } from '../notifications/email-queue.service.js';
import { accountService } from '../account/account.service.js';
import { evaluateCoupon } from '../promotions/coupon.service.js';
import type { CheckoutInput, OrderListQuery } from './order.schemas.js';

const orderInclude = {
  items: { orderBy: { createdAt: 'asc' as const } },
  shippingAddress: true,
} satisfies Prisma.OrderInclude;

const checkoutCartInclude = {
  items: {
    include: {
      product: {
        include: {
          category: { select: { isActive: true } },
          inventory: true,
        },
      },
    },
    orderBy: { productId: 'asc' as const },
  },
} satisfies Prisma.CartInclude;

type DatabaseOrder = Prisma.OrderGetPayload<{ include: typeof orderInclude }>;

const serializeOrder = (order: DatabaseOrder) => ({
  createdAt: order.createdAt.toISOString(),
  currency: order.currency,
  coupon: order.couponCode
    ? {
        code: order.couponCode,
        type: order.couponType,
        value: order.couponValue?.toFixed(2) ?? null,
      }
    : null,
  discountAmount: order.discountAmount.toFixed(2),
  id: order.id,
  items: order.items.map((item) => ({
    createdAt: item.createdAt.toISOString(),
    currency: item.currency,
    id: item.id,
    lineSubtotal: item.lineSubtotal.toFixed(2),
    productId: item.productId,
    productName: item.productName,
    quantity: item.quantity,
    sku: item.sku,
    unitPrice: item.unitPrice.toFixed(2),
  })),
  orderNumber: order.orderNumber,
  shippingAddress: order.shippingAddress
    ? {
        address: order.shippingAddress.address,
        city: order.shippingAddress.city,
        country: order.shippingAddress.country,
        createdAt: order.shippingAddress.createdAt.toISOString(),
        email: order.shippingAddress.email,
        fullName: order.shippingAddress.fullName,
        phone: order.shippingAddress.phone,
        postalCode: order.shippingAddress.postalCode,
        province: order.shippingAddress.province,
      }
    : null,
  status: order.status,
  subtotal: order.subtotal.toFixed(2),
  total: order.total.toFixed(2),
  updatedAt: order.updatedAt.toISOString(),
});

type ResolvedCheckoutInput = {
  couponCode?: string;
  shippingAddress: NonNullable<CheckoutInput['shippingAddress']>;
};

const checkoutFingerprint = (input: ResolvedCheckoutInput) => {
  const address = input.shippingAddress;
  return createHash('sha256')
    .update(
      JSON.stringify([
        address.fullName,
        address.phone,
        address.email,
        address.country,
        address.province,
        address.city,
        address.postalCode,
        address.address,
        input.couponCode ?? null,
      ]),
    )
    .digest('hex');
};

const createOrderNumber = () => {
  const date = new Date().toISOString().slice(0, 10).replaceAll('-', '');
  const suffix = randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase();
  return `AUR-${date}-${suffix}`;
};

const idempotencyMismatch = () =>
  new AppError(
    409,
    'IDEMPOTENCY_KEY_REUSED',
    'This idempotency key was already used with different checkout information.',
  );

const assertMatchingFingerprint = (order: DatabaseOrder, fingerprint: string) => {
  if (order.checkoutFingerprint !== fingerprint) throw idempotencyMismatch();
  return order;
};

const findIdempotentOrder = (userId: string, idempotencyKey: string) =>
  prisma.order.findUnique({
    include: orderInclude,
    where: { userId_idempotencyKey: { idempotencyKey, userId } },
  });

const isRetryableTransactionError = (error: unknown) => {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false;
  if (error.code === 'P2002' || error.code === 'P2034') return true;
  if (error.code !== 'P2010') return false;
  const databaseDetails = `${JSON.stringify(error.meta ?? {})} ${error.message}`;
  return /\b(?:1205|1213)\b|deadlock|lock wait timeout/i.test(databaseDetails);
};

const insufficientStock = (
  productId: string,
  availableQuantity: number,
  requestedQuantity: number,
) =>
  new AppError(409, 'INSUFFICIENT_STOCK', 'A cart item no longer has enough stock.', {
    availableQuantity,
    productId,
    requestedQuantity,
  });

const runCheckout = async (
  userId: string,
  idempotencyKey: string,
  fingerprint: string,
  input: ResolvedCheckoutInput,
) => {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await prisma.$transaction(
        async (transaction) => {
          const existing = await transaction.order.findUnique({
            include: orderInclude,
            where: { userId_idempotencyKey: { idempotencyKey, userId } },
          });
          if (existing) {
            return { created: false, order: assertMatchingFingerprint(existing, fingerprint) };
          }

          const cart = await transaction.cart.findUnique({
            include: checkoutCartInclude,
            where: { userId },
          });
          if (!cart || cart.items.length === 0) {
            throw new AppError(409, 'CHECKOUT_CART_EMPTY', 'Your cart is empty.');
          }
          if (!cart.currency) {
            throw new AppError(409, 'CART_CURRENCY_INVALID', 'The cart currency is missing.');
          }

          const priceChanges: Array<{
            currentCurrency: string;
            currentPrice: string;
            previousCurrency: string;
            previousPrice: string;
            productId: string;
            productName: string;
          }> = [];
          let subtotal = new Prisma.Decimal(0);

          for (const item of cart.items) {
            if (!item.product.isActive || !item.product.category.isActive) {
              throw new AppError(
                409,
                'CHECKOUT_PRODUCT_UNAVAILABLE',
                `${item.product.name} is no longer available.`,
                { productId: item.productId },
              );
            }
            if (item.currency !== cart.currency || item.product.currency !== cart.currency) {
              throw new AppError(
                409,
                'CART_CURRENCY_MISMATCH',
                'Every cart item must use the cart currency before checkout.',
                { cartCurrency: cart.currency, productId: item.productId },
              );
            }
            if (!item.product.price.equals(item.unitPrice)) {
              priceChanges.push({
                currentCurrency: item.product.currency,
                currentPrice: item.product.price.toFixed(2),
                previousCurrency: item.currency,
                previousPrice: item.unitPrice.toFixed(2),
                productId: item.productId,
                productName: item.product.name,
              });
            }

            const sellableQuantity = item.product.inventory
              ? Math.max(
                  0,
                  item.product.inventory.availableQuantity -
                    item.product.inventory.reservedQuantity,
                )
              : 0;
            if (sellableQuantity < item.quantity) {
              throw insufficientStock(item.productId, sellableQuantity, item.quantity);
            }
            subtotal = subtotal.add(item.product.price.mul(item.quantity));
          }

          if (priceChanges.length > 0) {
            throw new AppError(
              409,
              'CART_PRICE_CHANGED',
              'One or more product prices changed. Review your cart before checking out.',
              { items: priceChanges },
            );
          }

          const coupon = input.couponCode
            ? await evaluateCoupon(transaction, {
                code: input.couponCode,
                currency: cart.currency,
                subtotal,
                userId,
              })
            : null;
          const discountAmount = coupon?.discountAmount ?? new Prisma.Decimal(0);
          const total = subtotal.sub(discountAmount);

          for (const item of cart.items) {
            const affectedRows = await transaction.$executeRaw`
              UPDATE inventory
              SET available_quantity = available_quantity - ${item.quantity},
                  updated_at = CURRENT_TIMESTAMP(3)
              WHERE product_id = ${item.productId}
                AND available_quantity - reserved_quantity >= ${item.quantity}
            `;
            if (affectedRows !== 1) {
              const inventory = await transaction.inventory.findUnique({
                select: { availableQuantity: true, reservedQuantity: true },
                where: { productId: item.productId },
              });
              const sellableQuantity = inventory
                ? Math.max(0, inventory.availableQuantity - inventory.reservedQuantity)
                : 0;
              throw insufficientStock(item.productId, sellableQuantity, item.quantity);
            }
          }

          const order = await transaction.order.create({
            data: {
              checkoutFingerprint: fingerprint,
              ...(coupon
                ? {
                    couponCode: coupon.code,
                    couponId: coupon.couponId,
                    couponType: coupon.type,
                    couponValue: coupon.value,
                  }
                : {}),
              currency: cart.currency,
              discountAmount,
              idempotencyKey,
              items: {
                create: cart.items.map((item) => ({
                  currency: item.product.currency,
                  lineSubtotal: item.product.price.mul(item.quantity),
                  productId: item.productId,
                  productName: item.product.name,
                  quantity: item.quantity,
                  sku: item.product.sku,
                  unitPrice: item.product.price,
                })),
              },
              orderNumber: createOrderNumber(),
              shippingAddress: { create: input.shippingAddress },
              subtotal,
              total,
              userId,
            },
            include: orderInclude,
          });

          if (coupon) {
            await transaction.couponUsage.create({
              data: {
                couponCode: coupon.code,
                couponId: coupon.couponId,
                couponType: coupon.type,
                couponValue: coupon.value,
                currency: coupon.currency,
                discountAmount: coupon.discountAmount,
                orderId: order.id,
                userId,
              },
            });
          }

          await enqueueEmail(transaction, {
            deduplicationKey: `order:${order.id}:confirmation`,
            notificationType: EmailNotificationType.ORDER_CONFIRMATION,
            orderId: order.id,
            payload: {
              currency: order.currency,
              customerName: input.shippingAddress.fullName,
              orderNumber: order.orderNumber,
              total: order.total.toFixed(2),
            },
            recipientEmail: input.shippingAddress.email,
            subject: `Order ${order.orderNumber} confirmed`,
          });

          await transaction.cartItem.deleteMany({ where: { cartId: cart.id } });
          await transaction.cart.update({ data: { currency: null }, where: { id: cart.id } });

          return { created: true, order };
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          maxWait: 5_000,
          timeout: 20_000,
        },
      );
    } catch (error) {
      if (!isRetryableTransactionError(error)) throw error;

      const existing = await findIdempotentOrder(userId, idempotencyKey);
      if (existing) {
        return { created: false, order: assertMatchingFingerprint(existing, fingerprint) };
      }
      if (attempt === 3) {
        throw new AppError(
          409,
          'CHECKOUT_CONFLICT',
          'The cart or inventory changed during checkout. Review the cart and try again.',
        );
      }
    }
  }

  throw new AppError(409, 'CHECKOUT_CONFLICT', 'Checkout could not be completed safely.');
};

export const orderService = {
  checkout: async (userId: string, idempotencyKey: string, input: CheckoutInput) => {
    const shippingAddress = input.shippingAddress
      ? input.shippingAddress
      : await accountService.getOwnedAddressInput(userId, input.addressId!);
    const resolvedInput: ResolvedCheckoutInput = {
      ...(input.couponCode ? { couponCode: input.couponCode } : {}),
      shippingAddress,
    };
    const fingerprint = checkoutFingerprint(resolvedInput);
    const existing = await findIdempotentOrder(userId, idempotencyKey);
    if (existing) {
      return {
        created: false,
        order: serializeOrder(assertMatchingFingerprint(existing, fingerprint)),
      };
    }

    const result = await runCheckout(userId, idempotencyKey, fingerprint, resolvedInput);
    return { created: result.created, order: serializeOrder(result.order) };
  },

  listOrders: async (userId: string, query: OrderListQuery) => {
    const skip = (query.page - 1) * query.pageSize;
    const [totalItems, orders] = await prisma.$transaction([
      prisma.order.count({ where: { userId } }),
      prisma.order.findMany({
        include: orderInclude,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip,
        take: query.pageSize,
        where: { userId },
      }),
    ]);
    return {
      items: orders.map(serializeOrder),
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        totalItems,
        totalPages: Math.ceil(totalItems / query.pageSize),
      },
    };
  },

  getOrder: async (userId: string, id: string) => {
    const order = await prisma.order.findFirst({
      include: orderInclude,
      where: { id, userId },
    });
    if (!order) {
      throw new AppError(404, 'ORDER_NOT_FOUND', 'The requested order does not exist.');
    }
    return serializeOrder(order);
  },
};
