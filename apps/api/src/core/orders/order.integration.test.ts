import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { after, before, test } from 'node:test';
import type {
  ApiSuccess,
  AuthSessionData,
  CartData,
  CheckoutData,
  OrderDetailData,
  OrderListData,
} from '@aurelia/contracts';
import { Prisma } from '@prisma/client';
import { createApp } from '../../app.js';
import { prisma } from '../../infrastructure/database/prisma.js';
import { cleanupOperationalRecords } from '../../test/test-data-cleanup.js';
import { passwordService } from '../auth/password.service.js';

const password = 'StrongPassword123';
const customerEmail = 'checkout.customer@aurelia.test';
const competingEmailOne = 'checkout.competing.one@aurelia.test';
const competingEmailTwo = 'checkout.competing.two@aurelia.test';
const testEmails = [customerEmail, competingEmailOne, competingEmailTwo];
const categorySlug = 'checkout-integration-category';
const primarySku = 'CHECKOUT-TEST-PRIMARY';
const competingSku = 'CHECKOUT-TEST-CONCURRENT';
const server = createServer(createApp());
let baseUrl = '';
let primaryProductId = '';
let competingProductId = '';
const accessTokens = new Map<string, string>();

const shippingAddress = (email: string) => ({
  address: 'House 18, Street 7, Gulberg III',
  city: 'Lahore',
  country: 'Pakistan',
  email,
  fullName: 'Checkout Customer',
  phone: '+92 300 1234567',
  postalCode: '54660',
  province: 'Punjab',
});

const headers = (email: string, idempotencyKey?: string) => ({
  authorization: `Bearer ${accessTokens.get(email) ?? ''}`,
  'content-type': 'application/json',
  ...(idempotencyKey ? { 'idempotency-key': idempotencyKey } : {}),
});

const cleanup = async () => {
  await cleanupOperationalRecords(testEmails);
  await prisma.order.deleteMany({ where: { user: { email: { in: testEmails } } } });
  await prisma.user.deleteMany({ where: { email: { in: testEmails } } });
  await prisma.product.deleteMany({ where: { sku: { in: [primarySku, competingSku] } } });
  await prisma.category.deleteMany({ where: { slug: categorySlug } });
};

const login = async (email: string) => {
  const response = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    body: JSON.stringify({ email, password }),
    headers: { 'content-type': 'application/json' },
  });
  assert.equal(response.status, 200);
  const payload = (await response.json()) as ApiSuccess<AuthSessionData>;
  accessTokens.set(email, payload.data.accessToken);
};

const addToCart = async (email: string, productId: string, quantity: number) => {
  const response = await fetch(`${baseUrl}/cart/items`, {
    method: 'POST',
    body: JSON.stringify({ productId, quantity }),
    headers: headers(email),
  });
  assert.equal(response.status, 201);
  return ((await response.json()) as ApiSuccess<CartData>).data.cart;
};

const checkout = (email: string, idempotencyKey: string, address = shippingAddress(email)) =>
  fetch(`${baseUrl}/checkout`, {
    method: 'POST',
    body: JSON.stringify({ shippingAddress: address }),
    headers: headers(email, idempotencyKey),
  });

const errorCode = async (response: Response) => {
  const payload = (await response.json()) as { error: { code: string } };
  return payload.error.code;
};

before(async () => {
  await cleanup();
  const passwordHash = await passwordService.hash(password);
  await prisma.user.createMany({
    data: testEmails.map((email, index) => ({
      email,
      firstName: 'Checkout',
      lastName: `Customer ${index + 1}`,
      passwordHash,
    })),
  });
  const category = await prisma.category.create({
    data: { name: 'Checkout Integration Category', slug: categorySlug },
  });
  const [primaryProduct, competingProduct] = await Promise.all([
    prisma.product.create({
      data: {
        categoryId: category.id,
        description: 'Primary checkout integration product.',
        inventory: { create: { availableQuantity: 10 } },
        name: 'Checkout Snapshot Product',
        price: new Prisma.Decimal('1000.00'),
        sku: primarySku,
        slug: 'checkout-snapshot-product',
      },
    }),
    prisma.product.create({
      data: {
        categoryId: category.id,
        description: 'Single-unit concurrent checkout product.',
        inventory: { create: { availableQuantity: 1 } },
        name: 'Checkout Concurrent Product',
        price: new Prisma.Decimal('2500.00'),
        sku: competingSku,
        slug: 'checkout-concurrent-product',
      },
    }),
  ]);
  primaryProductId = primaryProduct.id;
  competingProductId = competingProduct.id;

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  baseUrl = `http://127.0.0.1:${address.port}/api/v1`;
  await Promise.all(testEmails.map(login));
});

after(async () => {
  await cleanup();
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
  await prisma.$disconnect();
});

void test('checkout validation, immutable orders, idempotency, ownership, and concurrency', async () => {
  const unauthorized = await fetch(`${baseUrl}/checkout`, {
    method: 'POST',
    body: JSON.stringify({ shippingAddress: shippingAddress(customerEmail) }),
    headers: { 'content-type': 'application/json', 'idempotency-key': crypto.randomUUID() },
  });
  assert.equal(unauthorized.status, 401);

  const missingKey = await fetch(`${baseUrl}/checkout`, {
    method: 'POST',
    body: JSON.stringify({ shippingAddress: shippingAddress(customerEmail) }),
    headers: headers(customerEmail),
  });
  assert.equal(missingKey.status, 400);
  assert.equal(await errorCode(missingKey), 'IDEMPOTENCY_KEY_REQUIRED');

  const emptyCart = await checkout(customerEmail, crypto.randomUUID());
  assert.equal(emptyCart.status, 409);
  assert.equal(await errorCode(emptyCart), 'CHECKOUT_CART_EMPTY');

  let cart = await addToCart(customerEmail, primaryProductId, 2);
  const cartItemId = cart.items[0]?.id;
  assert.ok(cartItemId);
  await prisma.product.update({
    data: { price: new Prisma.Decimal('1100.00') },
    where: { id: primaryProductId },
  });

  const changedPrice = await checkout(customerEmail, crypto.randomUUID());
  assert.equal(changedPrice.status, 409);
  assert.equal(await errorCode(changedPrice), 'CART_PRICE_CHANGED');
  assert.equal(await prisma.order.count({ where: { user: { email: customerEmail } } }), 0);

  const refreshSnapshot = await fetch(`${baseUrl}/cart/items/${cartItemId}`, {
    method: 'PATCH',
    body: JSON.stringify({ quantity: 2 }),
    headers: headers(customerEmail),
  });
  assert.equal(refreshSnapshot.status, 200);

  await prisma.product.update({ data: { isActive: false }, where: { id: primaryProductId } });
  const archivedProduct = await checkout(customerEmail, crypto.randomUUID());
  assert.equal(archivedProduct.status, 409);
  assert.equal(await errorCode(archivedProduct), 'CHECKOUT_PRODUCT_UNAVAILABLE');
  await prisma.product.update({ data: { isActive: true }, where: { id: primaryProductId } });

  await prisma.inventory.update({
    data: { availableQuantity: 1 },
    where: { productId: primaryProductId },
  });
  const outOfStock = await checkout(customerEmail, crypto.randomUUID());
  assert.equal(outOfStock.status, 409);
  assert.equal(await errorCode(outOfStock), 'INSUFFICIENT_STOCK');
  await prisma.inventory.update({
    data: { availableQuantity: 10 },
    where: { productId: primaryProductId },
  });

  const successfulKey = crypto.randomUUID();
  const successfulCheckout = await checkout(customerEmail, successfulKey);
  assert.equal(successfulCheckout.status, 201);
  const successfulOrder = ((await successfulCheckout.json()) as ApiSuccess<CheckoutData>).data
    .order;
  assert.match(successfulOrder.orderNumber, /^AUR-\d{8}-[A-F0-9]{12}$/);
  assert.equal(successfulOrder.status, 'PENDING');
  assert.equal(successfulOrder.currency, 'PKR');
  assert.equal(successfulOrder.subtotal, '2200.00');
  assert.equal(successfulOrder.total, '2200.00');
  assert.equal(successfulOrder.items.length, 1);
  assert.equal(successfulOrder.items[0]?.productName, 'Checkout Snapshot Product');
  assert.equal(successfulOrder.items[0]?.sku, primarySku);
  assert.equal(successfulOrder.items[0]?.unitPrice, '1100.00');
  assert.equal(successfulOrder.items[0]?.quantity, 2);
  assert.equal(successfulOrder.items[0]?.lineSubtotal, '2200.00');
  assert.equal(successfulOrder.shippingAddress?.city, 'Lahore');

  const inventoryAfterCheckout = await prisma.inventory.findUniqueOrThrow({
    where: { productId: primaryProductId },
  });
  assert.equal(inventoryAfterCheckout.availableQuantity, 8);
  const cartAfterCheckout = await fetch(`${baseUrl}/cart`, { headers: headers(customerEmail) });
  assert.equal(cartAfterCheckout.status, 200);
  cart = ((await cartAfterCheckout.json()) as ApiSuccess<CartData>).data.cart;
  assert.equal(cart.items.length, 0);
  assert.equal(cart.currency, null);

  const replay = await checkout(customerEmail, successfulKey);
  assert.equal(replay.status, 200);
  const replayOrder = ((await replay.json()) as ApiSuccess<CheckoutData>).data.order;
  assert.equal(replayOrder.id, successfulOrder.id);
  assert.equal(
    (await prisma.inventory.findUniqueOrThrow({ where: { productId: primaryProductId } }))
      .availableQuantity,
    8,
  );
  assert.equal(await prisma.order.count({ where: { user: { email: customerEmail } } }), 1);

  const changedAddress = shippingAddress(customerEmail);
  changedAddress.city = 'Islamabad';
  const reusedKey = await checkout(customerEmail, successfulKey, changedAddress);
  assert.equal(reusedKey.status, 409);
  assert.equal(await errorCode(reusedKey), 'IDEMPOTENCY_KEY_REUSED');

  await prisma.product.update({
    data: { name: 'Renamed Live Product', price: new Prisma.Decimal('9999.00') },
    where: { id: primaryProductId },
  });
  const orderDetail = await fetch(`${baseUrl}/orders/${successfulOrder.id}`, {
    headers: headers(customerEmail),
  });
  assert.equal(orderDetail.status, 200);
  const immutableOrder = ((await orderDetail.json()) as ApiSuccess<OrderDetailData>).data.order;
  assert.equal(immutableOrder.items[0]?.productName, 'Checkout Snapshot Product');
  assert.equal(immutableOrder.items[0]?.unitPrice, '1100.00');

  const orderList = await fetch(`${baseUrl}/orders?page=1&pageSize=10`, {
    headers: headers(customerEmail),
  });
  assert.equal(orderList.status, 200);
  const listedOrders = ((await orderList.json()) as ApiSuccess<OrderListData>).data;
  assert.equal(listedOrders.items.length, 1);
  assert.equal(listedOrders.pagination.totalItems, 1);

  const forbiddenOrder = await fetch(`${baseUrl}/orders/${successfulOrder.id}`, {
    headers: headers(competingEmailOne),
  });
  assert.equal(forbiddenOrder.status, 404);

  await Promise.all([
    addToCart(competingEmailOne, competingProductId, 1),
    addToCart(competingEmailTwo, competingProductId, 1),
  ]);
  const concurrentResponses = await Promise.all([
    checkout(competingEmailOne, crypto.randomUUID()),
    checkout(competingEmailTwo, crypto.randomUUID()),
  ]);
  const statuses = concurrentResponses.map((response) => response.status).sort();
  assert.deepEqual(statuses, [201, 409]);
  const failedConcurrentCheckout = concurrentResponses.find((response) => response.status === 409);
  assert.ok(failedConcurrentCheckout);
  assert.ok(
    ['CHECKOUT_CONFLICT', 'INSUFFICIENT_STOCK'].includes(await errorCode(failedConcurrentCheckout)),
  );
  assert.equal(
    (await prisma.inventory.findUniqueOrThrow({ where: { productId: competingProductId } }))
      .availableQuantity,
    0,
  );
  assert.equal(
    await prisma.order.count({ where: { items: { some: { productId: competingProductId } } } }),
    1,
  );
});
