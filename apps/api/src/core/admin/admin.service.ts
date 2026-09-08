import { AdminAuditAction, AdminAuditEntityType, OrderStatus, Prisma } from '@prisma/client';
import { env } from '../../config/env.js';
import { AppError } from '../../http/errors/app-error.js';
import { prisma } from '../../infrastructure/database/prisma.js';
import { transitionOrderStatus } from '../orders/order-status.service.js';
import { recordAdminAudit, type AdminAuditContext } from '../audit/audit.service.js';
import type {
  AdminCategoryListQuery,
  AdminInventoryListQuery,
  AdminOrderListQuery,
  AdminProductListQuery,
  AdminUserListQuery,
  OrderStatusUpdateInput,
} from './admin.schemas.js';

const lowStockThreshold = 5;

const pagination = (page: number, pageSize: number, totalItems: number) => ({
  page,
  pageSize,
  totalItems,
  totalPages: Math.ceil(totalItems / pageSize),
});

const activityFilter = (status: 'all' | 'active' | 'archived') =>
  status === 'all' ? undefined : status === 'active';

const productOrderBy = (
  sort: AdminProductListQuery['sort'],
): Prisma.ProductOrderByWithRelationInput[] => {
  const orders: Record<AdminProductListQuery['sort'], Prisma.ProductOrderByWithRelationInput> = {
    created_asc: { createdAt: 'asc' },
    created_desc: { createdAt: 'desc' },
    name_asc: { name: 'asc' },
    name_desc: { name: 'desc' },
    price_asc: { price: 'asc' },
    price_desc: { price: 'desc' },
  };
  return [orders[sort], { id: 'asc' }];
};

const categoryOrderBy = (
  sort: AdminCategoryListQuery['sort'],
): Prisma.CategoryOrderByWithRelationInput[] => {
  const orders: Record<AdminCategoryListQuery['sort'], Prisma.CategoryOrderByWithRelationInput> = {
    created_asc: { createdAt: 'asc' },
    created_desc: { createdAt: 'desc' },
    name_asc: { name: 'asc' },
    name_desc: { name: 'desc' },
  };
  return [orders[sort], { id: 'asc' }];
};

const orderOrderBy = (
  sort: AdminOrderListQuery['sort'],
): Prisma.OrderOrderByWithRelationInput[] => {
  const orders: Record<AdminOrderListQuery['sort'], Prisma.OrderOrderByWithRelationInput> = {
    created_asc: { createdAt: 'asc' },
    created_desc: { createdAt: 'desc' },
    total_asc: { total: 'asc' },
    total_desc: { total: 'desc' },
  };
  return [orders[sort], { id: 'desc' }];
};

const userOrderBy = (sort: AdminUserListQuery['sort']): Prisma.UserOrderByWithRelationInput[] => {
  if (sort === 'name_asc') return [{ firstName: 'asc' }, { lastName: 'asc' }, { id: 'asc' }];
  if (sort === 'name_desc') return [{ firstName: 'desc' }, { lastName: 'desc' }, { id: 'asc' }];
  return [{ createdAt: sort === 'created_asc' ? 'asc' : 'desc' }, { id: 'asc' }];
};

const inventoryValues = (
  inventory: {
    availableQuantity: number;
    reservedQuantity: number;
  } | null,
) => {
  const totalQuantity = inventory?.availableQuantity ?? 0;
  const reservedQuantity = inventory?.reservedQuantity ?? 0;
  const availableQuantity = Math.max(0, totalQuantity - reservedQuantity);
  return {
    availableQuantity,
    reservedQuantity,
    stockStatus:
      availableQuantity === 0
        ? ('OUT_OF_STOCK' as const)
        : availableQuantity <= lowStockThreshold
          ? ('LOW_STOCK' as const)
          : ('IN_STOCK' as const),
    totalQuantity,
  };
};

const adminProductDetailSelect = {
  category: {
    select: { id: true, isActive: true, name: true, slug: true },
  },
  categoryId: true,
  createdAt: true,
  currency: true,
  description: true,
  id: true,
  images: { orderBy: { position: 'asc' as const } },
  inventory: {
    select: { availableQuantity: true, reservedQuantity: true, updatedAt: true },
  },
  isActive: true,
  isFeatured: true,
  name: true,
  price: true,
  sku: true,
  slug: true,
  updatedAt: true,
} satisfies Prisma.ProductSelect;

type AdminProductDetailRow = Prisma.ProductGetPayload<{
  select: typeof adminProductDetailSelect;
}>;

const serializeProductDetail = (product: AdminProductDetailRow) => ({
  category: product.category,
  categoryId: product.categoryId,
  createdAt: product.createdAt.toISOString(),
  currency: product.currency,
  description: product.description,
  id: product.id,
  images: product.images.map((image) => ({
    altText: image.altText,
    createdAt: image.createdAt.toISOString(),
    id: image.id,
    position: image.position,
    updatedAt: image.updatedAt.toISOString(),
    url: image.path,
  })),
  inventory: {
    ...inventoryValues(product.inventory),
    updatedAt: product.inventory?.updatedAt.toISOString() ?? product.updatedAt.toISOString(),
  },
  isFeatured: product.isFeatured,
  isActive: product.isActive,
  name: product.name,
  price: product.price.toFixed(2),
  sku: product.sku,
  slug: product.slug,
  updatedAt: product.updatedAt.toISOString(),
});

const adminOrderDetailSelect = {
  createdAt: true,
  couponCode: true,
  couponType: true,
  couponValue: true,
  currency: true,
  discountAmount: true,
  id: true,
  items: {
    orderBy: { createdAt: 'asc' as const },
    select: {
      createdAt: true,
      currency: true,
      id: true,
      lineSubtotal: true,
      productId: true,
      productName: true,
      quantity: true,
      sku: true,
      unitPrice: true,
    },
  },
  orderNumber: true,
  shippingAddress: {
    select: {
      address: true,
      city: true,
      country: true,
      createdAt: true,
      email: true,
      fullName: true,
      phone: true,
      postalCode: true,
      province: true,
    },
  },
  shipment: {
    select: { courier: true, id: true, status: true, trackingNumber: true },
  },
  status: true,
  statusHistory: {
    orderBy: [{ createdAt: 'desc' as const }, { id: 'desc' as const }],
    select: {
      actorType: true,
      administrator: {
        select: { email: true, firstName: true, id: true, lastName: true },
      },
      createdAt: true,
      id: true,
      newStatus: true,
      note: true,
      previousStatus: true,
      systemActor: true,
    },
  },
  subtotal: true,
  total: true,
  updatedAt: true,
  user: {
    select: {
      email: true,
      firstName: true,
      id: true,
      lastName: true,
      status: true,
    },
  },
} satisfies Prisma.OrderSelect;

type AdminOrderDetailRow = Prisma.OrderGetPayload<{ select: typeof adminOrderDetailSelect }>;

const serializeOrderDetail = (order: AdminOrderDetailRow) => ({
  createdAt: order.createdAt.toISOString(),
  coupon: order.couponCode
    ? {
        code: order.couponCode,
        type: order.couponType,
        value: order.couponValue?.toFixed(2) ?? null,
      }
    : null,
  currency: order.currency,
  customer: order.user,
  id: order.id,
  items: order.items.map((item) => ({
    ...item,
    createdAt: item.createdAt.toISOString(),
    lineSubtotal: item.lineSubtotal.toFixed(2),
    unitPrice: item.unitPrice.toFixed(2),
  })),
  orderNumber: order.orderNumber,
  discountAmount: order.discountAmount.toFixed(2),
  shippingAddress: order.shippingAddress
    ? {
        ...order.shippingAddress,
        createdAt: order.shippingAddress.createdAt.toISOString(),
      }
    : null,
  shipment: order.shipment,
  status: order.status,
  statusHistory: order.statusHistory.map((entry) => ({
    ...entry,
    createdAt: entry.createdAt.toISOString(),
  })),
  subtotal: order.subtotal.toFixed(2),
  total: order.total.toFixed(2),
  updatedAt: order.updatedAt.toISOString(),
});

const findOrderDetail = (id: string) =>
  prisma.order.findUnique({ select: adminOrderDetailSelect, where: { id } });

export const adminService = {
  getDashboard: async () => {
    const [
      totalUsers,
      productGroups,
      totalCategories,
      orderGroups,
      revenueGroups,
      inventoryRows,
      recentOrders,
    ] = await prisma.$transaction([
      prisma.user.count({ where: { isGuest: false } }),
      prisma.product.groupBy({ by: ['isActive'], _count: { _all: true } }),
      prisma.category.count(),
      prisma.order.groupBy({ by: ['status'], _count: { _all: true } }),
      prisma.order.groupBy({
        by: ['currency'],
        where: { status: OrderStatus.DELIVERED },
        _sum: { total: true },
      }),
      prisma.$queryRaw<Array<{ lowStock: bigint; outOfStock: bigint }>>`
        SELECT
          SUM(CASE WHEN GREATEST(available_quantity - reserved_quantity, 0) BETWEEN 1 AND ${lowStockThreshold} THEN 1 ELSE 0 END) AS lowStock,
          SUM(CASE WHEN available_quantity - reserved_quantity <= 0 THEN 1 ELSE 0 END) AS outOfStock
        FROM inventory
      `,
      prisma.order.findMany({
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        select: {
          createdAt: true,
          currency: true,
          id: true,
          orderNumber: true,
          status: true,
          total: true,
          user: { select: { email: true, firstName: true, lastName: true } },
        },
        take: 5,
      }),
    ]);

    const productCount = (isActive: boolean) =>
      productGroups.find((group) => group.isActive === isActive)?._count._all ?? 0;
    const orderCount = (status: OrderStatus) =>
      orderGroups.find((group) => group.status === status)?._count._all ?? 0;
    const totalOrders = orderGroups.reduce((sum, group) => sum + group._count._all, 0);
    const inventory = inventoryRows[0];

    return {
      metrics: {
        activeProducts: productCount(true),
        archivedProducts: productCount(false),
        lowStockProducts: Number(inventory?.lowStock ?? 0),
        outOfStockProducts: Number(inventory?.outOfStock ?? 0),
        pendingOrders: orderCount(OrderStatus.PENDING),
        totalCategories,
        totalOrders,
        totalProducts: productCount(true) + productCount(false),
        totalUsers,
      },
      recentOrders: recentOrders.map(({ user, ...order }) => ({
        ...order,
        createdAt: order.createdAt.toISOString(),
        customer: user,
        total: order.total.toFixed(2),
      })),
      revenueByCurrency: revenueGroups.map((group) => ({
        amount: group._sum.total?.toFixed(2) ?? '0.00',
        currency: group.currency,
      })),
    };
  },

  listProducts: async (query: AdminProductListQuery) => {
    const isActive = activityFilter(query.status);
    const where: Prisma.ProductWhereInput = {
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      ...(isActive === undefined ? {} : { isActive }),
      ...(query.q
        ? {
            OR: [
              { name: { contains: query.q } },
              { sku: { contains: query.q } },
              { slug: { contains: query.q } },
            ],
          }
        : {}),
    };
    const skip = (query.page - 1) * query.pageSize;
    const [totalItems, products] = await prisma.$transaction([
      prisma.product.count({ where }),
      prisma.product.findMany({
        orderBy: productOrderBy(query.sort),
        select: {
          category: { select: { id: true, isActive: true, name: true, slug: true } },
          createdAt: true,
          currency: true,
          id: true,
          images: {
            orderBy: { position: 'asc' },
            select: { altText: true, id: true, path: true },
            take: 1,
          },
          inventory: { select: { availableQuantity: true, reservedQuantity: true } },
          isActive: true,
          isFeatured: true,
          name: true,
          price: true,
          sku: true,
          slug: true,
          updatedAt: true,
        },
        skip,
        take: query.pageSize,
        where,
      }),
    ]);

    return {
      items: products.map((product) => ({
        ...product,
        createdAt: product.createdAt.toISOString(),
        image: product.images[0]
          ? {
              altText: product.images[0].altText,
              id: product.images[0].id,
              url: product.images[0].path,
            }
          : null,
        images: undefined,
        inventory: inventoryValues(product.inventory),
        price: product.price.toFixed(2),
        updatedAt: product.updatedAt.toISOString(),
      })),
      pagination: pagination(query.page, query.pageSize, totalItems),
    };
  },

  getProduct: async (id: string) => {
    const product = await prisma.product.findUnique({
      select: adminProductDetailSelect,
      where: { id },
    });
    if (!product) throw new AppError(404, 'PRODUCT_NOT_FOUND', 'The product does not exist.');
    return serializeProductDetail(product);
  },

  listCategories: async (query: AdminCategoryListQuery) => {
    const isActive = activityFilter(query.status);
    const where: Prisma.CategoryWhereInput = {
      ...(isActive === undefined ? {} : { isActive }),
      ...(query.q
        ? { OR: [{ name: { contains: query.q } }, { slug: { contains: query.q } }] }
        : {}),
    };
    const skip = (query.page - 1) * query.pageSize;
    const [totalItems, categories] = await prisma.$transaction([
      prisma.category.count({ where }),
      prisma.category.findMany({
        orderBy: categoryOrderBy(query.sort),
        select: {
          _count: { select: { products: true } },
          createdAt: true,
          description: true,
          id: true,
          isActive: true,
          name: true,
          slug: true,
          updatedAt: true,
        },
        skip,
        take: query.pageSize,
        where,
      }),
    ]);
    const activeProductGroups = await prisma.product.groupBy({
      _count: { _all: true },
      by: ['categoryId'],
      where: { categoryId: { in: categories.map((category) => category.id) }, isActive: true },
    });
    const activeCounts = new Map(
      activeProductGroups.map((group) => [group.categoryId, group._count._all]),
    );

    return {
      items: categories.map(({ _count, ...category }) => ({
        ...category,
        activeProductCount: activeCounts.get(category.id) ?? 0,
        createdAt: category.createdAt.toISOString(),
        productCount: _count.products,
        updatedAt: category.updatedAt.toISOString(),
      })),
      pagination: pagination(query.page, query.pageSize, totalItems),
    };
  },

  listInventory: async (query: AdminInventoryListQuery) => {
    const skip = (query.page - 1) * query.pageSize;
    const stockCondition =
      query.stock === 'out_of_stock'
        ? Prisma.sql`COALESCE(inventory_record.available_quantity - inventory_record.reserved_quantity, 0) <= 0`
        : query.stock === 'low_stock'
          ? Prisma.sql`COALESCE(inventory_record.available_quantity - inventory_record.reserved_quantity, 0) BETWEEN 1 AND ${lowStockThreshold}`
          : query.stock === 'in_stock'
            ? Prisma.sql`COALESCE(inventory_record.available_quantity - inventory_record.reserved_quantity, 0) > ${lowStockThreshold}`
            : Prisma.sql`1 = 1`;
    const searchCondition = query.q
      ? Prisma.sql`(product.name LIKE ${`%${query.q}%`} OR product.sku LIKE ${`%${query.q}%`})`
      : Prisma.sql`1 = 1`;
    type InventoryCountRow = { totalItems: bigint };
    type InventoryRow = {
      availableQuantity: number | null;
      id: string;
      isActive: boolean | number;
      name: string;
      reservedQuantity: number | null;
      sku: string;
      updatedAt: Date | null;
    };
    const [countRows, products] = await prisma.$transaction([
      prisma.$queryRaw<InventoryCountRow[]>`
        SELECT COUNT(*) AS totalItems
        FROM products AS product
        LEFT JOIN inventory AS inventory_record ON inventory_record.product_id = product.id
        WHERE ${stockCondition} AND ${searchCondition}
      `,
      prisma.$queryRaw<InventoryRow[]>`
        SELECT
          product.id,
          product.name,
          product.sku,
          product.is_active AS isActive,
          inventory_record.available_quantity AS availableQuantity,
          inventory_record.reserved_quantity AS reservedQuantity,
          inventory_record.updated_at AS updatedAt
        FROM products AS product
        LEFT JOIN inventory AS inventory_record ON inventory_record.product_id = product.id
        WHERE ${stockCondition} AND ${searchCondition}
        ORDER BY product.name ASC, product.id ASC
        LIMIT ${query.pageSize} OFFSET ${skip}
      `,
    ]);
    const totalItems = Number(countRows[0]?.totalItems ?? 0);

    return {
      items: products.map((product) => ({
        id: product.id,
        inventory: {
          ...inventoryValues({
            availableQuantity: product.availableQuantity ?? 0,
            reservedQuantity: product.reservedQuantity ?? 0,
          }),
          updatedAt: product.updatedAt ? product.updatedAt.toISOString() : null,
        },
        isActive: Boolean(product.isActive),
        name: product.name,
        sku: product.sku,
      })),
      pagination: pagination(query.page, query.pageSize, totalItems),
    };
  },

  updateInventory: async (productId: string, totalQuantity: number, audit?: AdminAuditContext) => {
    const product = await prisma.product.findUnique({
      select: { id: true, name: true },
      where: { id: productId },
    });
    if (!product) throw new AppError(404, 'PRODUCT_NOT_FOUND', 'The product does not exist.');

    const inventory = await prisma.$transaction(async (transaction) => {
      const current = await transaction.inventory.findUnique({
        select: { availableQuantity: true, reservedQuantity: true },
        where: { productId },
      });
      if ((current?.reservedQuantity ?? 0) > totalQuantity) {
        throw new AppError(
          409,
          'INVENTORY_BELOW_RESERVED',
          'Total quantity cannot be lower than reserved quantity.',
        );
      }
      const updated = await transaction.inventory.upsert({
        create: { availableQuantity: totalQuantity, productId },
        update: { availableQuantity: totalQuantity },
        where: { productId },
      });
      if (audit) {
        await recordAdminAudit(transaction, audit, {
          action: AdminAuditAction.INVENTORY_UPDATED,
          entityId: productId,
          entityType: AdminAuditEntityType.INVENTORY,
          metadata: {
            previousTotalQuantity: current?.availableQuantity ?? null,
            totalQuantity,
          },
        });
      }
      return updated;
    });

    return {
      id: product.id,
      inventory: {
        ...inventoryValues(inventory),
        updatedAt: inventory.updatedAt.toISOString(),
      },
      name: product.name,
    };
  },

  listOrders: async (query: AdminOrderListQuery) => {
    const where: Prisma.OrderWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.q
        ? {
            OR: [
              { orderNumber: { contains: query.q } },
              { user: { email: { contains: query.q } } },
              { user: { firstName: { contains: query.q } } },
              { user: { lastName: { contains: query.q } } },
            ],
          }
        : {}),
    };
    const skip = (query.page - 1) * query.pageSize;
    const [totalItems, orders] = await prisma.$transaction([
      prisma.order.count({ where }),
      prisma.order.findMany({
        orderBy: orderOrderBy(query.sort),
        select: {
          _count: { select: { items: true } },
          createdAt: true,
          currency: true,
          id: true,
          orderNumber: true,
          status: true,
          total: true,
          updatedAt: true,
          user: { select: { email: true, firstName: true, id: true, lastName: true } },
        },
        skip,
        take: query.pageSize,
        where,
      }),
    ]);

    return {
      items: orders.map(({ _count, user, ...order }) => ({
        ...order,
        createdAt: order.createdAt.toISOString(),
        customer: user,
        itemCount: _count.items,
        total: order.total.toFixed(2),
        updatedAt: order.updatedAt.toISOString(),
      })),
      pagination: pagination(query.page, query.pageSize, totalItems),
    };
  },

  getOrder: async (id: string) => {
    const order = await findOrderDetail(id);
    if (!order) throw new AppError(404, 'ORDER_NOT_FOUND', 'The order does not exist.');
    return serializeOrderDetail(order);
  },

  updateOrderStatus: async (id: string, administratorId: string, input: OrderStatusUpdateInput) => {
    await prisma.$transaction(async (transaction) => {
      await transitionOrderStatus({
        actor: { id: administratorId, type: 'ADMIN' },
        nextStatus: input.status,
        ...(input.note ? { note: input.note } : {}),
        orderId: id,
        source: 'ADMIN',
        transaction,
      });
    });

    const order = await findOrderDetail(id);
    if (!order) throw new AppError(404, 'ORDER_NOT_FOUND', 'The order does not exist.');
    return serializeOrderDetail(order);
  },

  listUsers: async (query: AdminUserListQuery) => {
    const where: Prisma.UserWhereInput = {
      isGuest: false,
      ...(query.role ? { role: query.role } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.q
        ? {
            OR: [
              { email: { contains: query.q } },
              { firstName: { contains: query.q } },
              { lastName: { contains: query.q } },
            ],
          }
        : {}),
    };
    const skip = (query.page - 1) * query.pageSize;
    const [totalItems, users] = await prisma.$transaction([
      prisma.user.count({ where }),
      prisma.user.findMany({
        orderBy: userOrderBy(query.sort),
        select: {
          _count: { select: { orders: true } },
          createdAt: true,
          email: true,
          firstName: true,
          id: true,
          lastName: true,
          role: true,
          status: true,
        },
        skip,
        take: query.pageSize,
        where,
      }),
    ]);
    return {
      items: users.map(({ _count, ...user }) => ({
        ...user,
        createdAt: user.createdAt.toISOString(),
        orderCount: _count.orders,
      })),
      pagination: pagination(query.page, query.pageSize, totalItems),
    };
  },

  getSystemOverview: async () => {
    await prisma.$queryRaw`SELECT 1`;
    return {
      apiVersion: 'v1',
      database: 'ready' as const,
      environment: env.NODE_ENV,
      nodeVersion: process.version,
      service: 'veyora-api' as const,
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
    };
  },
};
