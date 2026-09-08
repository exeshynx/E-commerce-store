import { AdminAuditAction, AdminAuditEntityType, Prisma } from '@prisma/client';
import { prisma } from '../../infrastructure/database/prisma.js';
import { AppError } from '../../http/errors/app-error.js';
import { recordAdminAudit, type AdminAuditContext } from '../audit/audit.service.js';
import {
  createSlug,
  type CategoryCreateInput,
  type CategoryUpdateInput,
  type ImageUpdateInput,
  type ProductCreateInput,
  type ProductListQuery,
  type ProductUpdateInput,
} from './catalog.schemas.js';

const categorySelect = {
  createdAt: true,
  description: true,
  id: true,
  isActive: true,
  name: true,
  slug: true,
  updatedAt: true,
} satisfies Prisma.CategorySelect;

export const catalogProductInclude = {
  category: { select: categorySelect },
  images: { orderBy: { position: 'asc' as const } },
  inventory: true,
} satisfies Prisma.ProductInclude;

type DatabaseCategory = Prisma.CategoryGetPayload<{ select: typeof categorySelect }>;
export type DatabaseCatalogProduct = Prisma.ProductGetPayload<{
  include: typeof catalogProductInclude;
}>;

const serializeCategory = (category: DatabaseCategory) => ({
  ...category,
  createdAt: category.createdAt.toISOString(),
  updatedAt: category.updatedAt.toISOString(),
});

const serializeImage = (image: DatabaseCatalogProduct['images'][number]) => ({
  altText: image.altText,
  createdAt: image.createdAt.toISOString(),
  id: image.id,
  position: image.position,
  updatedAt: image.updatedAt.toISOString(),
  url: image.path,
});

export const serializeCatalogProduct = (product: DatabaseCatalogProduct) => {
  const availableQuantity = product.inventory
    ? Math.max(0, product.inventory.availableQuantity - product.inventory.reservedQuantity)
    : 0;

  return {
    category: serializeCategory(product.category),
    createdAt: product.createdAt.toISOString(),
    currency: product.currency,
    description: product.description,
    id: product.id,
    images: product.images.map(serializeImage),
    inventory: {
      availableQuantity,
      inStock: availableQuantity > 0,
    },
    isActive: product.isActive,
    isFeatured: product.isFeatured,
    name: product.name,
    price: product.price.toFixed(2),
    sku: product.sku,
    slug: product.slug,
    updatedAt: product.updatedAt.toISOString(),
  };
};

const duplicateResourceError = () =>
  new AppError(409, 'CATALOG_CONFLICT', 'A category, product slug, or SKU already exists.');

const handlePrismaWrite = async <T>(operation: () => Promise<T>) => {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw duplicateResourceError();
    }
    throw error;
  }
};

const requireCategory = async (id: string) => {
  const category = await prisma.category.findUnique({ where: { id }, select: { id: true } });
  if (!category) {
    throw new AppError(404, 'CATEGORY_NOT_FOUND', 'The requested category does not exist.');
  }
};

const requireProduct = async (id: string) => {
  const product = await prisma.product.findUnique({ where: { id }, select: { id: true } });
  if (!product) {
    throw new AppError(404, 'PRODUCT_NOT_FOUND', 'The requested product does not exist.');
  }
};

const resolveSlug = (name: string, slug?: string) => {
  const resolved = slug ?? createSlug(name);
  if (!resolved) {
    throw new AppError(422, 'INVALID_SLUG', 'A URL slug could not be generated from the name.');
  }
  return resolved;
};

type CatalogAuditContext = AdminAuditContext & { action?: AdminAuditAction };

const auditCatalogWrite = (
  transaction: Prisma.TransactionClient,
  audit: CatalogAuditContext | undefined,
  input: {
    action: AdminAuditAction;
    entityId: string;
    entityType: AdminAuditEntityType;
    metadata?: Prisma.InputJsonValue;
  },
) =>
  audit
    ? recordAdminAudit(transaction, audit, {
        ...input,
        action: audit.action ?? input.action,
      })
    : Promise.resolve();

export const catalogService = {
  listCategories: async () => {
    const categories = await prisma.category.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: {
        ...categorySelect,
        _count: {
          select: {
            products: {
              where: { isActive: true },
            },
          },
        },
      },
    });

    return categories.map(({ _count, ...category }) => ({
      ...serializeCategory(category),
      productCount: _count.products,
    }));
  },

  listProducts: async (query: ProductListQuery) => {
    const where: Prisma.ProductWhereInput = {
      isActive: true,
      category: {
        isActive: true,
        ...(query.category ? { slug: query.category } : {}),
      },
      ...(query.q
        ? {
            OR: [
              { name: { contains: query.q } },
              { description: { contains: query.q } },
              { sku: { contains: query.q } },
            ],
          }
        : {}),
    };
    const skip = (query.page - 1) * query.pageSize;
    const [totalItems, products] = await prisma.$transaction([
      prisma.product.count({ where }),
      prisma.product.findMany({
        include: catalogProductInclude,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip,
        take: query.pageSize,
        where,
      }),
    ]);

    return {
      items: products.map(serializeCatalogProduct),
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        totalItems,
        totalPages: Math.ceil(totalItems / query.pageSize),
      },
    };
  },

  getProduct: async (identifier: string) => {
    const product = await prisma.product.findFirst({
      include: catalogProductInclude,
      where: {
        isActive: true,
        category: { isActive: true },
        OR: [{ id: identifier }, { slug: identifier }],
      },
    });

    if (!product) {
      throw new AppError(404, 'PRODUCT_NOT_FOUND', 'The requested product does not exist.');
    }
    return serializeCatalogProduct(product);
  },

  createCategory: async (input: CategoryCreateInput, audit?: CatalogAuditContext) =>
    handlePrismaWrite(async () => {
      const category = await prisma.$transaction(async (transaction) => {
        const created = await transaction.category.create({
          data: {
            ...(input.description !== undefined ? { description: input.description } : {}),
            isActive: input.isActive,
            name: input.name,
            slug: resolveSlug(input.name, input.slug),
          },
          select: categorySelect,
        });
        await auditCatalogWrite(transaction, audit, {
          action: AdminAuditAction.CATEGORY_CREATED,
          entityId: created.id,
          entityType: AdminAuditEntityType.CATEGORY,
          metadata: { name: created.name, slug: created.slug },
        });
        return created;
      });
      return serializeCategory(category);
    }),

  updateCategory: async (id: string, input: CategoryUpdateInput, audit?: CatalogAuditContext) =>
    handlePrismaWrite(async () => {
      await requireCategory(id);
      const category = await prisma.$transaction(async (transaction) => {
        const updated = await transaction.category.update({
          data: {
            ...(input.description !== undefined ? { description: input.description } : {}),
            ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
            ...(input.name ? { name: input.name } : {}),
            ...(input.slug ? { slug: input.slug } : {}),
          },
          select: categorySelect,
          where: { id },
        });
        await auditCatalogWrite(transaction, audit, {
          action: AdminAuditAction.CATEGORY_UPDATED,
          entityId: id,
          entityType: AdminAuditEntityType.CATEGORY,
          metadata: input,
        });
        return updated;
      });
      return serializeCategory(category);
    }),

  archiveCategory: async (id: string, audit?: CatalogAuditContext) => {
    await requireCategory(id);
    await prisma.$transaction(async (transaction) => {
      await transaction.category.update({ data: { isActive: false }, where: { id } });
      await auditCatalogWrite(transaction, audit, {
        action: AdminAuditAction.CATEGORY_ARCHIVED,
        entityId: id,
        entityType: AdminAuditEntityType.CATEGORY,
      });
    });
  },

  createProduct: async (input: ProductCreateInput, audit?: CatalogAuditContext) =>
    handlePrismaWrite(async () => {
      await requireCategory(input.categoryId);
      const product = await prisma.$transaction(async (transaction) => {
        const created = await transaction.product.create({
          data: {
            categoryId: input.categoryId,
            currency: input.currency,
            description: input.description,
            inventory: {
              create: { availableQuantity: input.availableQuantity },
            },
            isActive: input.isActive,
            isFeatured: input.isFeatured,
            name: input.name,
            price: new Prisma.Decimal(input.price),
            sku: input.sku,
            slug: resolveSlug(input.name, input.slug),
          },
          include: catalogProductInclude,
        });
        await auditCatalogWrite(transaction, audit, {
          action: AdminAuditAction.PRODUCT_CREATED,
          entityId: created.id,
          entityType: AdminAuditEntityType.PRODUCT,
          metadata: { name: created.name, sku: created.sku },
        });
        return created;
      });
      return serializeCatalogProduct(product);
    }),

  updateProduct: async (id: string, input: ProductUpdateInput, audit?: CatalogAuditContext) =>
    handlePrismaWrite(async () => {
      await requireProduct(id);
      if (input.categoryId) await requireCategory(input.categoryId);

      const product = await prisma.$transaction(async (transaction) => {
        if (input.availableQuantity !== undefined) {
          const inventory = await transaction.inventory.findUnique({
            where: { productId: id },
            select: { reservedQuantity: true },
          });
          if (inventory && input.availableQuantity < inventory.reservedQuantity) {
            throw new AppError(
              409,
              'INVENTORY_BELOW_RESERVED',
              'Available quantity cannot be lower than reserved quantity.',
            );
          }
          await transaction.inventory.upsert({
            create: { availableQuantity: input.availableQuantity, productId: id },
            update: { availableQuantity: input.availableQuantity },
            where: { productId: id },
          });
        }

        const updated = await transaction.product.update({
          data: {
            ...(input.categoryId ? { categoryId: input.categoryId } : {}),
            ...(input.currency ? { currency: input.currency } : {}),
            ...(input.description !== undefined ? { description: input.description } : {}),
            ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
            ...(input.isFeatured !== undefined ? { isFeatured: input.isFeatured } : {}),
            ...(input.name ? { name: input.name } : {}),
            ...(input.price !== undefined ? { price: new Prisma.Decimal(input.price) } : {}),
            ...(input.sku ? { sku: input.sku } : {}),
            ...(input.slug ? { slug: input.slug } : {}),
          },
          include: catalogProductInclude,
          where: { id },
        });
        await auditCatalogWrite(transaction, audit, {
          action: AdminAuditAction.PRODUCT_UPDATED,
          entityId: id,
          entityType: AdminAuditEntityType.PRODUCT,
          metadata: input,
        });
        return updated;
      });
      return serializeCatalogProduct(product);
    }),

  archiveProduct: async (id: string, audit?: CatalogAuditContext) => {
    await requireProduct(id);
    await prisma.$transaction(async (transaction) => {
      await transaction.product.update({ data: { isActive: false }, where: { id } });
      await auditCatalogWrite(transaction, audit, {
        action: AdminAuditAction.PRODUCT_ARCHIVED,
        entityId: id,
        entityType: AdminAuditEntityType.PRODUCT,
      });
    });
  },

  addProductImage: async (
    productId: string,
    path: string,
    altText?: string | null,
    audit?: CatalogAuditContext,
  ) => {
    await requireProduct(productId);
    const lastImage = await prisma.productImage.findFirst({
      orderBy: { position: 'desc' },
      select: { position: true },
      where: { productId },
    });
    const image = await prisma.$transaction(async (transaction) => {
      const created = await transaction.productImage.create({
        data: {
          ...(altText !== undefined ? { altText } : {}),
          path,
          position: (lastImage?.position ?? -1) + 1,
          productId,
        },
      });
      await auditCatalogWrite(transaction, audit, {
        action: AdminAuditAction.PRODUCT_IMAGE_ADDED,
        entityId: productId,
        entityType: AdminAuditEntityType.PRODUCT,
        metadata: { imageId: created.id },
      });
      return created;
    });
    return serializeImage(image);
  },

  updateProductImage: async (
    productId: string,
    imageId: string,
    input: ImageUpdateInput,
    audit?: CatalogAuditContext,
  ) => {
    const current = await prisma.productImage.findFirst({
      where: { id: imageId, productId },
    });
    if (!current) {
      throw new AppError(404, 'PRODUCT_IMAGE_NOT_FOUND', 'The product image does not exist.');
    }

    const image = await prisma.$transaction(async (transaction) => {
      if (input.position !== undefined && input.position !== current.position) {
        const displaced = await transaction.productImage.findUnique({
          where: {
            productId_position: { position: input.position, productId },
          },
        });
        await transaction.productImage.update({
          data: { position: -1 },
          where: { id: current.id },
        });
        if (displaced) {
          await transaction.productImage.update({
            data: { position: current.position },
            where: { id: displaced.id },
          });
        }
      }

      const updated = await transaction.productImage.update({
        data: {
          ...(input.altText !== undefined ? { altText: input.altText } : {}),
          ...(input.position !== undefined ? { position: input.position } : {}),
        },
        where: { id: current.id },
      });
      await auditCatalogWrite(transaction, audit, {
        action: AdminAuditAction.PRODUCT_IMAGE_UPDATED,
        entityId: productId,
        entityType: AdminAuditEntityType.PRODUCT,
        metadata: { imageId, ...input },
      });
      return updated;
    });
    return serializeImage(image);
  },

  removeProductImage: async (productId: string, imageId: string, audit?: CatalogAuditContext) => {
    const image = await prisma.productImage.findFirst({
      where: { id: imageId, productId },
    });
    if (!image) {
      throw new AppError(404, 'PRODUCT_IMAGE_NOT_FOUND', 'The product image does not exist.');
    }
    await prisma.$transaction(async (transaction) => {
      await transaction.productImage.delete({ where: { id: image.id } });
      await auditCatalogWrite(transaction, audit, {
        action: AdminAuditAction.PRODUCT_IMAGE_REMOVED,
        entityId: productId,
        entityType: AdminAuditEntityType.PRODUCT,
        metadata: { imageId },
      });
    });
    return image.path;
  },
};
