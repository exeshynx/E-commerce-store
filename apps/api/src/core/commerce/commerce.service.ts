import { Prisma } from '@prisma/client';
import { prisma } from '../../infrastructure/database/prisma.js';
import { AppError } from '../../http/errors/app-error.js';
import type { AddCartItemInput, UpdateCartItemInput } from './commerce.schemas.js';

const productSelect = {
  category: {
    select: {
      id: true,
      isActive: true,
      name: true,
      slug: true,
    },
  },
  currency: true,
  id: true,
  images: {
    orderBy: { position: 'asc' as const },
    select: {
      altText: true,
      id: true,
      path: true,
      position: true,
    },
  },
  inventory: {
    select: {
      availableQuantity: true,
      reservedQuantity: true,
    },
  },
  isActive: true,
  name: true,
  price: true,
  sku: true,
  slug: true,
} satisfies Prisma.ProductSelect;

const cartInclude = {
  items: {
    include: { product: { select: productSelect } },
    orderBy: { createdAt: 'asc' as const },
  },
} satisfies Prisma.CartInclude;

const wishlistInclude = {
  items: {
    include: { product: { select: productSelect } },
    orderBy: { createdAt: 'desc' as const },
  },
} satisfies Prisma.WishlistInclude;

type CommerceProduct = Prisma.ProductGetPayload<{ select: typeof productSelect }>;
type DatabaseCart = Prisma.CartGetPayload<{ include: typeof cartInclude }>;
type DatabaseWishlist = Prisma.WishlistGetPayload<{ include: typeof wishlistInclude }>;

type UnavailableReason =
  'PRODUCT_INACTIVE' | 'CATEGORY_INACTIVE' | 'OUT_OF_STOCK' | 'INSUFFICIENT_STOCK';

const sellableQuantity = (product: CommerceProduct) =>
  product.inventory
    ? Math.max(0, product.inventory.availableQuantity - product.inventory.reservedQuantity)
    : 0;

const unavailableReason = (
  product: CommerceProduct,
  requestedQuantity = 1,
): UnavailableReason | null => {
  if (!product.isActive) return 'PRODUCT_INACTIVE';
  if (!product.category.isActive) return 'CATEGORY_INACTIVE';
  const availableQuantity = sellableQuantity(product);
  if (availableQuantity === 0) return 'OUT_OF_STOCK';
  if (availableQuantity < requestedQuantity) return 'INSUFFICIENT_STOCK';
  return null;
};

const serializeProduct = (product: CommerceProduct) => ({
  category: {
    id: product.category.id,
    name: product.category.name,
    slug: product.category.slug,
  },
  currency: product.currency,
  id: product.id,
  images: product.images.map((image) => ({
    altText: image.altText,
    id: image.id,
    position: image.position,
    url: image.path,
  })),
  name: product.name,
  price: product.price.toFixed(2),
  sku: product.sku,
  slug: product.slug,
});

const serializeCart = (cart: DatabaseCart) => {
  let subtotal = new Prisma.Decimal(0);
  let totalQuantity = 0;
  const items = cart.items.map((item) => {
    const reason = unavailableReason(item.product, item.quantity);
    const lineSubtotal = reason ? new Prisma.Decimal(0) : item.unitPrice.mul(item.quantity);
    subtotal = subtotal.add(lineSubtotal);
    totalQuantity += item.quantity;

    return {
      createdAt: item.createdAt.toISOString(),
      currency: item.currency,
      id: item.id,
      isAvailable: reason === null,
      lineSubtotal: lineSubtotal.toFixed(2),
      product: serializeProduct(item.product),
      quantity: item.quantity,
      unavailableReason: reason,
      unitPrice: item.unitPrice.toFixed(2),
      updatedAt: item.updatedAt.toISOString(),
    };
  });

  return {
    createdAt: cart.createdAt.toISOString(),
    currency: cart.currency,
    id: cart.id,
    items,
    subtotal: subtotal.toFixed(2),
    totalQuantity,
    updatedAt: cart.updatedAt.toISOString(),
  };
};

const serializeWishlist = (wishlist: DatabaseWishlist) => ({
  createdAt: wishlist.createdAt.toISOString(),
  id: wishlist.id,
  items: wishlist.items.map((item) => {
    const reason = unavailableReason(item.product);
    return {
      createdAt: item.createdAt.toISOString(),
      id: item.id,
      isAvailable: reason === null,
      product: serializeProduct(item.product),
      unavailableReason: reason,
      updatedAt: item.updatedAt.toISOString(),
    };
  }),
  updatedAt: wishlist.updatedAt.toISOString(),
});

const getCart = async (userId: string) => {
  await prisma.cart.upsert({
    create: { userId },
    update: {},
    where: { userId },
  });
  const cart = await prisma.cart.findUniqueOrThrow({
    include: cartInclude,
    where: { userId },
  });
  return serializeCart(cart);
};

const getWishlist = async (userId: string) => {
  await prisma.wishlist.upsert({
    create: { userId },
    update: {},
    where: { userId },
  });
  const wishlist = await prisma.wishlist.findUniqueOrThrow({
    include: wishlistInclude,
    where: { userId },
  });
  return serializeWishlist(wishlist);
};

const productUnavailable = (reason: UnavailableReason) =>
  new AppError(409, 'PRODUCT_UNAVAILABLE', 'This product is not currently available.', { reason });

const insufficientStock = (availableQuantity: number, requestedQuantity: number) =>
  new AppError(409, 'INSUFFICIENT_STOCK', 'The requested quantity exceeds available stock.', {
    availableQuantity,
    requestedQuantity,
  });

const runSerializableCartTransaction = async <T>(
  operation: (transaction: Prisma.TransactionClient) => Promise<T>,
) => {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await prisma.$transaction(operation, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 5_000,
        timeout: 10_000,
      });
    } catch (error) {
      const retryable =
        error instanceof Prisma.PrismaClientKnownRequestError &&
        (error.code === 'P2002' || error.code === 'P2034');
      if (!retryable || attempt === 3) throw error;
    }
  }

  throw new AppError(409, 'CART_CONFLICT', 'The cart changed. Review it and try again.');
};

export const commerceService = {
  getCart,

  addCartItem: async (userId: string, input: AddCartItemInput) => {
    await runSerializableCartTransaction(async (transaction) => {
      const product = await transaction.product.findUnique({
        select: productSelect,
        where: { id: input.productId },
      });
      if (!product) {
        throw new AppError(404, 'PRODUCT_NOT_FOUND', 'The requested product does not exist.');
      }
      const reason = unavailableReason(product);
      if (reason && reason !== 'INSUFFICIENT_STOCK') throw productUnavailable(reason);

      const cart = await transaction.cart.upsert({
        create: { userId },
        update: {},
        where: { userId },
      });
      if (cart.currency && cart.currency !== product.currency) {
        throw new AppError(
          409,
          'CART_CURRENCY_MISMATCH',
          `This cart accepts ${cart.currency}; the product uses ${product.currency}.`,
        );
      }

      const existing = await transaction.cartItem.findUnique({
        where: {
          cartId_productId: { cartId: cart.id, productId: product.id },
        },
      });
      const combinedQuantity = (existing?.quantity ?? 0) + input.quantity;
      const availableQuantity = sellableQuantity(product);
      if (combinedQuantity > availableQuantity) {
        throw insufficientStock(availableQuantity, combinedQuantity);
      }

      await transaction.cart.update({
        data: { currency: product.currency },
        where: { id: cart.id },
      });
      await transaction.cartItem.upsert({
        create: {
          cartId: cart.id,
          currency: product.currency,
          productId: product.id,
          quantity: combinedQuantity,
          unitPrice: product.price,
        },
        update: {
          currency: product.currency,
          quantity: combinedQuantity,
          unitPrice: product.price,
        },
        where: {
          cartId_productId: { cartId: cart.id, productId: product.id },
        },
      });
    });
    return getCart(userId);
  },

  updateCartItem: async (userId: string, itemId: string, input: UpdateCartItemInput) => {
    await runSerializableCartTransaction(async (transaction) => {
      const item = await transaction.cartItem.findFirst({
        include: {
          cart: { select: { currency: true, id: true } },
          product: { select: productSelect },
        },
        where: { id: itemId, cart: { userId } },
      });
      if (!item) {
        throw new AppError(404, 'CART_ITEM_NOT_FOUND', 'The requested cart item does not exist.');
      }
      const reason = unavailableReason(item.product);
      if (reason && reason !== 'INSUFFICIENT_STOCK') throw productUnavailable(reason);

      const availableQuantity = sellableQuantity(item.product);
      if (input.quantity > availableQuantity) {
        throw insufficientStock(availableQuantity, input.quantity);
      }

      if (item.cart.currency && item.cart.currency !== item.product.currency) {
        const otherItems = await transaction.cartItem.count({
          where: { cartId: item.cart.id, id: { not: item.id } },
        });
        if (otherItems > 0) {
          throw new AppError(
            409,
            'CART_CURRENCY_MISMATCH',
            `This cart accepts ${item.cart.currency}; the product now uses ${item.product.currency}.`,
          );
        }
        await transaction.cart.update({
          data: { currency: item.product.currency },
          where: { id: item.cart.id },
        });
      }

      await transaction.cartItem.update({
        data: {
          currency: item.product.currency,
          quantity: input.quantity,
          unitPrice: item.product.price,
        },
        where: { id: item.id },
      });
    });
    return getCart(userId);
  },

  removeCartItem: async (userId: string, itemId: string) => {
    await prisma.$transaction(async (transaction) => {
      const item = await transaction.cartItem.findFirst({
        select: { cartId: true, id: true },
        where: { id: itemId, cart: { userId } },
      });
      if (!item) {
        throw new AppError(404, 'CART_ITEM_NOT_FOUND', 'The requested cart item does not exist.');
      }
      await transaction.cartItem.delete({ where: { id: item.id } });
      const remainingItems = await transaction.cartItem.count({ where: { cartId: item.cartId } });
      if (remainingItems === 0) {
        await transaction.cart.update({ data: { currency: null }, where: { id: item.cartId } });
      }
    });
  },

  clearCart: async (userId: string) => {
    const cart = await prisma.cart.findUnique({ where: { userId }, select: { id: true } });
    if (!cart) return;
    await prisma.$transaction([
      prisma.cartItem.deleteMany({ where: { cartId: cart.id } }),
      prisma.cart.update({ data: { currency: null }, where: { id: cart.id } }),
    ]);
  },

  getWishlist,

  addWishlistItem: async (userId: string, productId: string) => {
    const product = await prisma.product.findUnique({
      select: productSelect,
      where: { id: productId },
    });
    if (!product) {
      throw new AppError(404, 'PRODUCT_NOT_FOUND', 'The requested product does not exist.');
    }
    const reason = unavailableReason(product);
    if (reason === 'PRODUCT_INACTIVE' || reason === 'CATEGORY_INACTIVE') {
      throw productUnavailable(reason);
    }

    const wishlist = await prisma.wishlist.upsert({
      create: { userId },
      update: {},
      where: { userId },
    });
    const existing = await prisma.wishlistItem.findUnique({
      where: { wishlistId_productId: { productId, wishlistId: wishlist.id } },
      select: { id: true },
    });
    if (!existing) {
      await prisma.wishlistItem.create({ data: { productId, wishlistId: wishlist.id } });
    }
    return { created: !existing, wishlist: await getWishlist(userId) };
  },

  removeWishlistItem: async (userId: string, productId: string) => {
    const wishlist = await prisma.wishlist.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!wishlist) return;
    await prisma.wishlistItem.deleteMany({ where: { productId, wishlistId: wishlist.id } });
  },
};
