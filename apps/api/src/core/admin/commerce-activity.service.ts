import { PaymentStatus } from '@prisma/client';
import { prisma } from '../../infrastructure/database/prisma.js';

export const commerceActivityService = {
  getOverview: async () => {
    const [carts, purchases] = await prisma.$transaction([
      prisma.cart.findMany({
        orderBy: { updatedAt: 'desc' },
        select: {
          id: true,
          updatedAt: true,
          user: {
            select: { email: true, firstName: true, id: true, isGuest: true, lastName: true },
          },
          items: {
            orderBy: { updatedAt: 'desc' },
            select: {
              id: true,
              product: { select: { id: true, name: true, sku: true, slug: true } },
              quantity: true,
              updatedAt: true,
            },
          },
        },
        take: 200,
        where: { items: { some: {} } },
      }),
      prisma.order.findMany({
        orderBy: { createdAt: 'desc' },
        select: {
          createdAt: true,
          id: true,
          orderNumber: true,
          shippingAddress: { select: { email: true, fullName: true } },
          total: true,
          currency: true,
          user: {
            select: { email: true, firstName: true, id: true, isGuest: true, lastName: true },
          },
          items: { select: { productId: true, productName: true, quantity: true, sku: true } },
        },
        take: 200,
        where: { paymentAttempts: { some: { status: PaymentStatus.SUCCEEDED } } },
      }),
    ]);
    return {
      carts: carts.map((cart) => ({
        ...cart,
        updatedAt: cart.updatedAt.toISOString(),
        items: cart.items.map((item) => ({ ...item, updatedAt: item.updatedAt.toISOString() })),
      })),
      purchases: purchases.map((purchase) => ({
        ...purchase,
        createdAt: purchase.createdAt.toISOString(),
        total: purchase.total.toFixed(2),
      })),
    };
  },
};
