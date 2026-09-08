import { AdminAuditAction, AdminAuditEntityType, CouponType, Prisma } from '@prisma/client';
import { prisma } from '../../infrastructure/database/prisma.js';
import { AppError } from '../../http/errors/app-error.js';
import { recordAdminAudit, type AdminAuditContext } from '../audit/audit.service.js';
import type {
  AdminCouponListQuery,
  CouponCreateInput,
  CouponUpdateInput,
} from './coupon.schemas.js';

const couponSelect = {
  _count: { select: { usages: true } },
  code: true,
  createdAt: true,
  currency: true,
  description: true,
  expiresAt: true,
  id: true,
  isEnabled: true,
  maximumUses: true,
  maximumUsesPerCustomer: true,
  minimumOrderValue: true,
  startsAt: true,
  type: true,
  updatedAt: true,
  value: true,
} satisfies Prisma.CouponSelect;

type DatabaseCoupon = Prisma.CouponGetPayload<{ select: typeof couponSelect }>;

const serializeCoupon = ({ _count, ...coupon }: DatabaseCoupon) => ({
  ...coupon,
  createdAt: coupon.createdAt.toISOString(),
  expiresAt: coupon.expiresAt?.toISOString() ?? null,
  minimumOrderValue: coupon.minimumOrderValue?.toFixed(2) ?? null,
  startsAt: coupon.startsAt?.toISOString() ?? null,
  totalUses: _count.usages,
  updatedAt: coupon.updatedAt.toISOString(),
  value: coupon.value.toFixed(2),
});

type CouponEvaluation = {
  code: string;
  couponId: string;
  currency: string;
  discountAmount: Prisma.Decimal;
  type: CouponType;
  value: Prisma.Decimal;
};

const validateDefinition = (coupon: {
  expiresAt: Date | null;
  startsAt: Date | null;
  type: CouponType;
  value: Prisma.Decimal;
}) => {
  if (coupon.startsAt && coupon.expiresAt && coupon.expiresAt <= coupon.startsAt) {
    throw new AppError(
      422,
      'COUPON_DATE_RANGE_INVALID',
      'Coupon expiry must follow its start date.',
    );
  }
  if (coupon.type === CouponType.PERCENTAGE && coupon.value.gt(100)) {
    throw new AppError(422, 'COUPON_PERCENTAGE_INVALID', 'Percentage coupons cannot exceed 100%.');
  }
};

const calculateDiscount = (type: CouponType, value: Prisma.Decimal, subtotal: Prisma.Decimal) => {
  const raw =
    type === CouponType.PERCENTAGE
      ? subtotal.mul(value).div(100).toDecimalPlaces(2)
      : value.toDecimalPlaces(2);
  return Prisma.Decimal.min(raw, subtotal);
};

export const evaluateCoupon = async (
  transaction: Prisma.TransactionClient,
  input: {
    code: string;
    currency: string;
    now?: Date;
    subtotal: Prisma.Decimal;
    userId: string;
  },
): Promise<CouponEvaluation> => {
  const code = input.code.trim().toUpperCase();
  const locked = await transaction.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM coupons WHERE code = ${code} FOR UPDATE
  `;
  if (!locked[0]) throw new AppError(404, 'COUPON_NOT_FOUND', 'This coupon does not exist.');
  const coupon = await transaction.coupon.findUnique({ where: { id: locked[0].id } });
  if (!coupon) throw new AppError(404, 'COUPON_NOT_FOUND', 'This coupon does not exist.');
  const now = input.now ?? new Date();
  if (!coupon.isEnabled) throw new AppError(409, 'COUPON_DISABLED', 'This coupon is disabled.');
  if (coupon.startsAt && coupon.startsAt > now) {
    throw new AppError(409, 'COUPON_NOT_STARTED', 'This coupon is not active yet.');
  }
  if (coupon.expiresAt && coupon.expiresAt <= now) {
    throw new AppError(409, 'COUPON_EXPIRED', 'This coupon has expired.');
  }
  if (coupon.currency !== input.currency) {
    throw new AppError(409, 'COUPON_CURRENCY_MISMATCH', 'This coupon uses another currency.', {
      cartCurrency: input.currency,
      couponCurrency: coupon.currency,
    });
  }
  if (coupon.minimumOrderValue && input.subtotal.lt(coupon.minimumOrderValue)) {
    throw new AppError(
      409,
      'COUPON_MINIMUM_NOT_MET',
      `The order subtotal must be at least ${coupon.minimumOrderValue.toFixed(2)} ${coupon.currency}.`,
    );
  }
  const [totalUses, customerUses] = await Promise.all([
    transaction.couponUsage.count({ where: { couponId: coupon.id } }),
    transaction.couponUsage.count({ where: { couponId: coupon.id, userId: input.userId } }),
  ]);
  if (coupon.maximumUses !== null && totalUses >= coupon.maximumUses) {
    throw new AppError(
      409,
      'COUPON_USAGE_LIMIT_REACHED',
      'This coupon has reached its usage limit.',
    );
  }
  if (coupon.maximumUsesPerCustomer !== null && customerUses >= coupon.maximumUsesPerCustomer) {
    throw new AppError(
      409,
      'COUPON_CUSTOMER_LIMIT_REACHED',
      'You have reached the usage limit for this coupon.',
    );
  }
  validateDefinition(coupon);
  return {
    code: coupon.code,
    couponId: coupon.id,
    currency: coupon.currency,
    discountAmount: calculateDiscount(coupon.type, coupon.value, input.subtotal),
    type: coupon.type,
    value: coupon.value,
  };
};

const createWriteData = (input: CouponCreateInput): Prisma.CouponCreateInput => ({
  code: input.code,
  currency: input.currency,
  description: input.description ?? null,
  expiresAt: input.expiresAt ?? null,
  isEnabled: input.isEnabled,
  maximumUses: input.maximumUses ?? null,
  maximumUsesPerCustomer: input.maximumUsesPerCustomer ?? null,
  minimumOrderValue: input.minimumOrderValue ?? null,
  startsAt: input.startsAt ?? null,
  type: input.type,
  value: new Prisma.Decimal(input.value),
});

const updateWriteData = (input: CouponUpdateInput): Prisma.CouponUpdateInput => ({
  ...(input.code !== undefined ? { code: input.code } : {}),
  ...(input.currency !== undefined ? { currency: input.currency } : {}),
  ...(input.description !== undefined ? { description: input.description } : {}),
  ...(input.expiresAt !== undefined ? { expiresAt: input.expiresAt } : {}),
  ...(input.isEnabled !== undefined ? { isEnabled: input.isEnabled } : {}),
  ...(input.maximumUses !== undefined ? { maximumUses: input.maximumUses } : {}),
  ...(input.maximumUsesPerCustomer !== undefined
    ? { maximumUsesPerCustomer: input.maximumUsesPerCustomer }
    : {}),
  ...(input.minimumOrderValue !== undefined ? { minimumOrderValue: input.minimumOrderValue } : {}),
  ...(input.startsAt !== undefined ? { startsAt: input.startsAt } : {}),
  ...(input.type !== undefined ? { type: input.type } : {}),
  ...(input.value !== undefined ? { value: new Prisma.Decimal(input.value) } : {}),
});

const duplicateCoupon = () =>
  new AppError(409, 'COUPON_CODE_CONFLICT', 'A coupon with this code already exists.');

export const couponService = {
  previewCartCoupon: async (userId: string, code: string) =>
    prisma.$transaction(
      async (transaction) => {
        const cart = await transaction.cart.findUnique({
          include: {
            items: {
              include: { product: { include: { category: { select: { isActive: true } } } } },
            },
          },
          where: { userId },
        });
        if (!cart?.currency || cart.items.length === 0) {
          throw new AppError(409, 'CHECKOUT_CART_EMPTY', 'Your cart is empty.');
        }
        const subtotal = cart.items.reduce(
          (sum, item) =>
            item.product.isActive && item.product.category.isActive
              ? sum.add(item.unitPrice.mul(item.quantity))
              : sum,
          new Prisma.Decimal(0),
        );
        const coupon = await evaluateCoupon(transaction, {
          code,
          currency: cart.currency,
          subtotal,
          userId,
        });
        return {
          code: coupon.code,
          currency: coupon.currency,
          discountAmount: coupon.discountAmount.toFixed(2),
          subtotal: subtotal.toFixed(2),
          total: subtotal.sub(coupon.discountAmount).toFixed(2),
          type: coupon.type,
          value: coupon.value.toFixed(2),
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    ),

  listCoupons: async (query: AdminCouponListQuery) => {
    const now = new Date();
    const where: Prisma.CouponWhereInput = {
      ...(query.q
        ? { OR: [{ code: { contains: query.q } }, { description: { contains: query.q } }] }
        : {}),
      ...(query.status === 'enabled'
        ? { isEnabled: true }
        : query.status === 'disabled'
          ? { isEnabled: false }
          : query.status === 'active'
            ? {
                AND: [
                  { isEnabled: true },
                  { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
                  { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
                ],
              }
            : query.status === 'expired'
              ? { expiresAt: { lte: now } }
              : query.status === 'scheduled'
                ? { startsAt: { gt: now } }
                : {}),
    };
    const skip = (query.page - 1) * query.pageSize;
    const [totalItems, coupons] = await prisma.$transaction([
      prisma.coupon.count({ where }),
      prisma.coupon.findMany({
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        select: couponSelect,
        skip,
        take: query.pageSize,
        where,
      }),
    ]);
    return {
      items: coupons.map(serializeCoupon),
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        totalItems,
        totalPages: Math.ceil(totalItems / query.pageSize),
      },
    };
  },

  createCoupon: async (input: CouponCreateInput, audit: AdminAuditContext) => {
    try {
      const coupon = await prisma.$transaction(async (transaction) => {
        const created = await transaction.coupon.create({ data: createWriteData(input) });
        validateDefinition({
          expiresAt: created.expiresAt,
          startsAt: created.startsAt,
          type: created.type,
          value: created.value,
        });
        await recordAdminAudit(transaction, audit, {
          action: AdminAuditAction.COUPON_CREATED,
          entityId: created.id,
          entityType: AdminAuditEntityType.COUPON,
          metadata: { code: created.code, isEnabled: created.isEnabled, type: created.type },
        });
        return transaction.coupon.findUniqueOrThrow({
          select: couponSelect,
          where: { id: created.id },
        });
      });
      return serializeCoupon(coupon);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw duplicateCoupon();
      }
      throw error;
    }
  },

  updateCoupon: async (id: string, input: CouponUpdateInput, audit: AdminAuditContext) => {
    try {
      const coupon = await prisma.$transaction(async (transaction) => {
        const existing = await transaction.coupon.findUnique({ where: { id } });
        if (!existing) throw new AppError(404, 'COUPON_NOT_FOUND', 'The coupon does not exist.');
        const merged = {
          expiresAt: input.expiresAt === undefined ? existing.expiresAt : input.expiresAt,
          startsAt: input.startsAt === undefined ? existing.startsAt : input.startsAt,
          type: input.type ?? existing.type,
          value: new Prisma.Decimal(input.value ?? existing.value),
        };
        validateDefinition(merged);
        const updated = await transaction.coupon.update({
          data: updateWriteData(input),
          where: { id },
        });
        const action =
          input.isEnabled === undefined
            ? AdminAuditAction.COUPON_UPDATED
            : input.isEnabled
              ? AdminAuditAction.COUPON_ENABLED
              : AdminAuditAction.COUPON_DISABLED;
        await recordAdminAudit(transaction, audit, {
          action,
          entityId: id,
          entityType: AdminAuditEntityType.COUPON,
          metadata: { code: updated.code, changes: Object.keys(input) },
        });
        return transaction.coupon.findUniqueOrThrow({ select: couponSelect, where: { id } });
      });
      return serializeCoupon(coupon);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw duplicateCoupon();
      }
      throw error;
    }
  },
};
