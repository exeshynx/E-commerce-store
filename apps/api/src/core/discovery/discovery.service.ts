import { OrderStatus, Prisma, ReviewStatus } from '@prisma/client';
import { prisma } from '../../infrastructure/database/prisma.js';
import { AppError } from '../../http/errors/app-error.js';
import {
  catalogProductInclude,
  serializeCatalogProduct,
  type DatabaseCatalogProduct,
} from '../catalog/catalog.service.js';
import type { RecommendationQuery, SearchQuery } from './discovery.schemas.js';

type ProductMetric = {
  averageRating: Prisma.Decimal | number | null;
  id: string;
  reviewCount: bigint | number;
  soldQuantity: Prisma.Decimal | bigint | number | null;
};

const numberValue = (value: Prisma.Decimal | bigint | number | null | undefined) =>
  value === null || value === undefined ? 0 : Number(value);

const enrichProduct = (product: DatabaseCatalogProduct, metric?: ProductMetric) => ({
  ...serializeCatalogProduct(product),
  rating: {
    average: numberValue(metric?.averageRating).toFixed(2),
    count: numberValue(metric?.reviewCount),
  },
  soldQuantity: numberValue(metric?.soldQuantity),
});

const fetchMetrics = async (productIds: string[]) => {
  if (productIds.length === 0) return new Map<string, ProductMetric>();
  const [reviews, sales] = await prisma.$transaction([
    prisma.review.groupBy({
      _avg: { rating: true },
      _count: { _all: true },
      by: ['productId'],
      where: {
        deletedAt: null,
        productId: { in: productIds },
        status: ReviewStatus.APPROVED,
      },
    }),
    prisma.orderItem.groupBy({
      _sum: { quantity: true },
      by: ['productId'],
      where: { order: { status: OrderStatus.DELIVERED }, productId: { in: productIds } },
    }),
  ]);
  const salesMap = new Map(sales.map((item) => [item.productId, item._sum.quantity ?? 0]));
  return new Map(
    productIds.map((id) => {
      const review = reviews.find((item) => item.productId === id);
      return [
        id,
        {
          averageRating: review?._avg.rating ?? 0,
          id,
          reviewCount: review?._count._all ?? 0,
          soldQuantity: salesMap.get(id) ?? 0,
        },
      ];
    }),
  );
};

const fetchProductsInOrder = async (ids: string[], metrics?: Map<string, ProductMetric>) => {
  if (ids.length === 0) return [];
  const products = await prisma.product.findMany({
    include: catalogProductInclude,
    where: { id: { in: ids }, isActive: true, category: { isActive: true } },
  });
  const map = new Map(products.map((product) => [product.id, product]));
  const resolvedMetrics = metrics ?? (await fetchMetrics(ids));
  return ids.flatMap((id) => {
    const product = map.get(id);
    return product ? [enrichProduct(product, resolvedMetrics.get(id))] : [];
  });
};

const productMetricSubqueries = Prisma.sql`
  LEFT JOIN (
    SELECT product_id, AVG(rating) AS average_rating, COUNT(*) AS review_count
    FROM reviews
    WHERE status = 'APPROVED' AND deleted_at IS NULL
    GROUP BY product_id
  ) AS review_metric ON review_metric.product_id = product.id
  LEFT JOIN (
    SELECT order_item.product_id, SUM(order_item.quantity) AS sold_quantity
    FROM order_items AS order_item
    INNER JOIN orders AS customer_order ON customer_order.id = order_item.order_id
    WHERE customer_order.status = 'DELIVERED'
    GROUP BY order_item.product_id
  ) AS sales_metric ON sales_metric.product_id = product.id
`;

const searchConditions = (query: SearchQuery) => {
  const conditions: Prisma.Sql[] = [
    Prisma.sql`product.is_active = true`,
    Prisma.sql`category.is_active = true`,
  ];
  if (query.q) {
    const contains = `%${query.q}%`;
    conditions.push(
      Prisma.sql`(product.name LIKE ${contains} OR product.description LIKE ${contains} OR product.sku LIKE ${contains})`,
    );
  }
  if (query.category) conditions.push(Prisma.sql`category.slug = ${query.category}`);
  if (query.minimumPrice !== undefined) {
    conditions.push(Prisma.sql`product.price >= ${query.minimumPrice}`);
  }
  if (query.maximumPrice !== undefined) {
    conditions.push(Prisma.sql`product.price <= ${query.maximumPrice}`);
  }
  if (query.minimumRating !== undefined) {
    conditions.push(
      Prisma.sql`COALESCE(review_metric.average_rating, 0) >= ${query.minimumRating}`,
    );
  }
  if (query.availability === 'in_stock') {
    conditions.push(
      Prisma.sql`COALESCE(inventory_record.available_quantity - inventory_record.reserved_quantity, 0) > 0`,
    );
  }
  if (query.availability === 'out_of_stock') {
    conditions.push(
      Prisma.sql`COALESCE(inventory_record.available_quantity - inventory_record.reserved_quantity, 0) <= 0`,
    );
  }
  return Prisma.join(conditions, ' AND ');
};

const searchOrder = (query: SearchQuery) => {
  if (query.sort === 'price_low') return Prisma.sql`product.price ASC, product.id ASC`;
  if (query.sort === 'price_high') return Prisma.sql`product.price DESC, product.id ASC`;
  if (query.sort === 'newest') return Prisma.sql`product.created_at DESC, product.id DESC`;
  if (query.sort === 'best_selling') {
    return Prisma.sql`COALESCE(sales_metric.sold_quantity, 0) DESC, product.created_at DESC, product.id DESC`;
  }
  if (query.sort === 'highest_rated') {
    return Prisma.sql`COALESCE(review_metric.average_rating, 0) DESC, COALESCE(review_metric.review_count, 0) DESC, product.id ASC`;
  }
  if (query.q) {
    const prefix = `${query.q}%`;
    return Prisma.sql`CASE WHEN product.name = ${query.q} THEN 0 WHEN product.name LIKE ${prefix} THEN 1 WHEN product.sku = ${query.q} THEN 2 ELSE 3 END ASC, COALESCE(sales_metric.sold_quantity, 0) DESC, product.created_at DESC`;
  }
  return Prisma.sql`product.created_at DESC, product.id DESC`;
};

export const discoveryService = {
  search: async (query: SearchQuery) => {
    const conditions = searchConditions(query);
    const order = searchOrder(query);
    const skip = (query.page - 1) * query.pageSize;
    const [countRows, rows] = await prisma.$transaction([
      prisma.$queryRaw<Array<{ totalItems: bigint }>>`
        SELECT COUNT(*) AS totalItems
        FROM products AS product
        INNER JOIN categories AS category ON category.id = product.category_id
        LEFT JOIN inventory AS inventory_record ON inventory_record.product_id = product.id
        ${productMetricSubqueries}
        WHERE ${conditions}
      `,
      prisma.$queryRaw<ProductMetric[]>`
        SELECT
          product.id,
          COALESCE(review_metric.average_rating, 0) AS averageRating,
          COALESCE(review_metric.review_count, 0) AS reviewCount,
          COALESCE(sales_metric.sold_quantity, 0) AS soldQuantity
        FROM products AS product
        INNER JOIN categories AS category ON category.id = product.category_id
        LEFT JOIN inventory AS inventory_record ON inventory_record.product_id = product.id
        ${productMetricSubqueries}
        WHERE ${conditions}
        ORDER BY ${order}
        LIMIT ${query.pageSize} OFFSET ${skip}
      `,
    ]);
    const metricMap = new Map(rows.map((row) => [row.id, row]));
    const items = await fetchProductsInOrder(
      rows.map((row) => row.id),
      metricMap,
    );
    const totalItems = Number(countRows[0]?.totalItems ?? 0);
    return {
      items,
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        totalItems,
        totalPages: Math.ceil(totalItems / query.pageSize),
      },
    };
  },

  autocomplete: async (q: string, limit: number) => {
    const products = await prisma.product.findMany({
      orderBy: [{ isFeatured: 'desc' }, { name: 'asc' }],
      select: {
        category: { select: { name: true } },
        id: true,
        images: {
          orderBy: { position: 'asc' },
          select: { altText: true, path: true },
          take: 1,
        },
        name: true,
        slug: true,
      },
      take: limit,
      where: {
        category: { isActive: true },
        isActive: true,
        OR: [{ name: { contains: q } }, { sku: { contains: q } }],
      },
    });
    return products.map((product) => ({
      categoryName: product.category.name,
      id: product.id,
      image: product.images[0]
        ? { altText: product.images[0].altText, url: product.images[0].path }
        : null,
      name: product.name,
      slug: product.slug,
    }));
  },

  recommendations: async (query: RecommendationQuery, userId?: string) => {
    let ids: string[];
    if (query.type === 'recently_viewed') {
      if (!userId) return { items: [], type: query.type };
      const views = await prisma.productView.findMany({
        orderBy: { viewedAt: 'desc' },
        select: { productId: true },
        take: query.limit,
        where: { product: { isActive: true, category: { isActive: true } }, userId },
      });
      ids = views.map((view) => view.productId);
    } else if (query.type === 'related') {
      if (!query.productId) {
        throw new AppError(422, 'PRODUCT_ID_REQUIRED', 'Related products require a product ID.');
      }
      const product = await prisma.product.findUnique({
        select: { categoryId: true },
        where: { id: query.productId },
      });
      if (!product) throw new AppError(404, 'PRODUCT_NOT_FOUND', 'The product does not exist.');
      const related = await prisma.product.findMany({
        orderBy: [{ isFeatured: 'desc' }, { createdAt: 'desc' }],
        select: { id: true },
        take: query.limit,
        where: {
          category: { isActive: true },
          categoryId: product.categoryId,
          id: { not: query.productId },
          isActive: true,
        },
      });
      ids = related.map((item) => item.id);
    } else if (query.type === 'best_sellers' || query.type === 'trending') {
      const since = new Date(Date.now() - 30 * 86_400_000);
      const rows = await prisma.$queryRaw<Array<{ id: string }>>`
        SELECT order_item.product_id AS id
        FROM order_items AS order_item
        INNER JOIN orders AS customer_order ON customer_order.id = order_item.order_id
        INNER JOIN products AS product ON product.id = order_item.product_id
        INNER JOIN categories AS category ON category.id = product.category_id
        WHERE customer_order.status = 'DELIVERED'
          AND product.is_active = true
          AND category.is_active = true
          ${query.type === 'trending' ? Prisma.sql`AND customer_order.created_at >= ${since}` : Prisma.empty}
        GROUP BY order_item.product_id
        ORDER BY SUM(order_item.quantity) DESC, MAX(customer_order.created_at) DESC
        LIMIT ${query.limit}
      `;
      ids = rows.map((row) => row.id);
    } else {
      const products = await prisma.product.findMany({
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        select: { id: true },
        take: query.limit,
        where: {
          category: { isActive: true },
          isActive: true,
          ...(query.type === 'featured' ? { isFeatured: true } : {}),
        },
      });
      ids = products.map((product) => product.id);
    }
    return { items: await fetchProductsInOrder(ids), type: query.type };
  },

  recordView: async (userId: string, productId: string) => {
    const product = await prisma.product.findFirst({
      select: { id: true },
      where: { category: { isActive: true }, id: productId, isActive: true },
    });
    if (!product) throw new AppError(404, 'PRODUCT_NOT_FOUND', 'The product does not exist.');
    await prisma.productView.upsert({
      create: { productId, userId },
      update: { viewedAt: new Date() },
      where: { userId_productId: { productId, userId } },
    });
  },
};
