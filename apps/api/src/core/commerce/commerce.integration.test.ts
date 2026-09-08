import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { after, before, test } from 'node:test';
import type { ApiSuccess, AuthSessionData, CartData, WishlistData } from '@aurelia/contracts';
import { Prisma } from '@prisma/client';
import { createApp } from '../../app.js';
import { prisma } from '../../infrastructure/database/prisma.js';
import { passwordService } from '../auth/password.service.js';

const email = 'commerce.integration@aurelia.test';
const password = 'StrongPassword123';
const categorySlug = 'commerce-integration-category';
const primarySku = 'COMMERCE-TEST-PKR';
const foreignCurrencySku = 'COMMERCE-TEST-USD';
const inactiveSku = 'COMMERCE-TEST-INACTIVE';
const server = createServer(createApp());
let baseUrl = '';
let accessToken = '';
let primaryProductId = '';
let foreignCurrencyProductId = '';
let inactiveProductId = '';

const headers = () => ({
  authorization: `Bearer ${accessToken}`,
  'content-type': 'application/json',
});

const cleanup = async () => {
  await prisma.user.deleteMany({ where: { email } });
  await prisma.product.deleteMany({
    where: { sku: { in: [primarySku, foreignCurrencySku, inactiveSku] } },
  });
  await prisma.category.deleteMany({ where: { slug: categorySlug } });
};

const getCart = async () => {
  const response = await fetch(`${baseUrl}/cart`, { headers: headers() });
  assert.equal(response.status, 200);
  return ((await response.json()) as ApiSuccess<CartData>).data.cart;
};

const getWishlist = async () => {
  const response = await fetch(`${baseUrl}/wishlist`, { headers: headers() });
  assert.equal(response.status, 200);
  return ((await response.json()) as ApiSuccess<WishlistData>).data.wishlist;
};

before(async () => {
  await cleanup();
  const passwordHash = await passwordService.hash(password);
  await prisma.user.create({
    data: { email, firstName: 'Commerce', lastName: 'Tester', passwordHash },
  });
  const category = await prisma.category.create({
    data: { name: 'Commerce Integration Category', slug: categorySlug },
  });
  const [primary, foreignCurrency, inactive] = await Promise.all([
    prisma.product.create({
      data: {
        categoryId: category.id,
        currency: 'PKR',
        description: 'Primary cart test product.',
        inventory: { create: { availableQuantity: 5 } },
        name: 'Commerce Primary Product',
        price: new Prisma.Decimal('1000.00'),
        sku: primarySku,
        slug: 'commerce-primary-product',
      },
    }),
    prisma.product.create({
      data: {
        categoryId: category.id,
        currency: 'USD',
        description: 'Foreign-currency cart test product.',
        inventory: { create: { availableQuantity: 5 } },
        name: 'Commerce USD Product',
        price: new Prisma.Decimal('10.00'),
        sku: foreignCurrencySku,
        slug: 'commerce-usd-product',
      },
    }),
    prisma.product.create({
      data: {
        categoryId: category.id,
        description: 'Inactive cart test product.',
        inventory: { create: { availableQuantity: 5 } },
        isActive: false,
        name: 'Commerce Inactive Product',
        price: new Prisma.Decimal('500.00'),
        sku: inactiveSku,
        slug: 'commerce-inactive-product',
      },
    }),
  ]);
  primaryProductId = primary.id;
  foreignCurrencyProductId = foreignCurrency.id;
  inactiveProductId = inactive.id;

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  baseUrl = `http://127.0.0.1:${address.port}/api/v1`;

  const login = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  assert.equal(login.status, 200);
  accessToken = ((await login.json()) as ApiSuccess<AuthSessionData>).data.accessToken;
});

after(async () => {
  await cleanup();
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
  await prisma.$disconnect();
});

void test('snapshot pricing, inventory, currency, cart, and wishlist lifecycle', async () => {
  const unauthorized = await fetch(`${baseUrl}/cart`);
  assert.equal(unauthorized.status, 401);

  const initialCart = await getCart();
  assert.equal(initialCart.items.length, 0);
  assert.equal(initialCart.currency, null);

  const firstAdd = await fetch(`${baseUrl}/cart/items`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ productId: primaryProductId, quantity: 2 }),
  });
  assert.equal(firstAdd.status, 201);
  let cart = ((await firstAdd.json()) as ApiSuccess<CartData>).data.cart;
  assert.equal(cart.currency, 'PKR');
  assert.equal(cart.items.length, 1);
  assert.equal(cart.items[0]?.unitPrice, '1000.00');
  assert.equal(cart.items[0]?.lineSubtotal, '2000.00');
  assert.equal(cart.subtotal, '2000.00');
  assert.equal(cart.totalQuantity, 2);

  await prisma.product.update({
    data: { price: new Prisma.Decimal('1200.00') },
    where: { id: primaryProductId },
  });
  cart = await getCart();
  assert.equal(cart.items[0]?.unitPrice, '1000.00');
  assert.equal(cart.subtotal, '2000.00');

  const repeatedAdd = await fetch(`${baseUrl}/cart/items`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ productId: primaryProductId, quantity: 1 }),
  });
  assert.equal(repeatedAdd.status, 201);
  cart = ((await repeatedAdd.json()) as ApiSuccess<CartData>).data.cart;
  assert.equal(cart.items.length, 1);
  assert.equal(cart.items[0]?.quantity, 3);
  assert.equal(cart.items[0]?.unitPrice, '1200.00');
  assert.equal(cart.subtotal, '3600.00');

  const insufficientStock = await fetch(`${baseUrl}/cart/items`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ productId: primaryProductId, quantity: 3 }),
  });
  assert.equal(insufficientStock.status, 409);
  const insufficientPayload = (await insufficientStock.json()) as {
    error: { code: string };
  };
  assert.equal(insufficientPayload.error.code, 'INSUFFICIENT_STOCK');

  const currencyMismatch = await fetch(`${baseUrl}/cart/items`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ productId: foreignCurrencyProductId, quantity: 1 }),
  });
  assert.equal(currencyMismatch.status, 409);
  const currencyPayload = (await currencyMismatch.json()) as { error: { code: string } };
  assert.equal(currencyPayload.error.code, 'CART_CURRENCY_MISMATCH');

  const inactiveAdd = await fetch(`${baseUrl}/cart/items`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ productId: inactiveProductId, quantity: 1 }),
  });
  assert.equal(inactiveAdd.status, 409);

  const wishlistAdd = await fetch(`${baseUrl}/wishlist/items`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ productId: primaryProductId }),
  });
  assert.equal(wishlistAdd.status, 201);
  const duplicateWishlistAdd = await fetch(`${baseUrl}/wishlist/items`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ productId: primaryProductId }),
  });
  assert.equal(duplicateWishlistAdd.status, 200);
  let wishlist = await getWishlist();
  assert.equal(wishlist.items.length, 1);

  const cartItemId = cart.items[0]?.id;
  assert.ok(cartItemId);
  await prisma.product.update({ data: { isActive: false }, where: { id: primaryProductId } });

  cart = await getCart();
  assert.equal(cart.items[0]?.isAvailable, false);
  assert.equal(cart.items[0]?.unavailableReason, 'PRODUCT_INACTIVE');
  assert.equal(cart.subtotal, '0.00');
  assert.equal(cart.totalQuantity, 3);
  wishlist = await getWishlist();
  assert.equal(wishlist.items[0]?.isAvailable, false);

  const updateArchived = await fetch(`${baseUrl}/cart/items/${cartItemId}`, {
    method: 'PATCH',
    headers: headers(),
    body: JSON.stringify({ quantity: 4 }),
  });
  assert.equal(updateArchived.status, 409);

  const removeArchived = await fetch(`${baseUrl}/cart/items/${cartItemId}`, {
    method: 'DELETE',
    headers: headers(),
  });
  assert.equal(removeArchived.status, 204);
  cart = await getCart();
  assert.equal(cart.items.length, 0);
  assert.equal(cart.currency, null);

  const removeWishlist = await fetch(`${baseUrl}/wishlist/items/${primaryProductId}`, {
    method: 'DELETE',
    headers: headers(),
  });
  assert.equal(removeWishlist.status, 204);
  assert.equal((await getWishlist()).items.length, 0);

  await prisma.product.update({ data: { isActive: true }, where: { id: primaryProductId } });
  await prisma.product.update({
    data: { price: new Prisma.Decimal('1300.00') },
    where: { id: primaryProductId },
  });
  const addAgain = await fetch(`${baseUrl}/cart/items`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ productId: primaryProductId, quantity: 1 }),
  });
  assert.equal(addAgain.status, 201);
  cart = ((await addAgain.json()) as ApiSuccess<CartData>).data.cart;
  assert.equal(cart.items[0]?.unitPrice, '1300.00');

  const clear = await fetch(`${baseUrl}/cart`, { method: 'DELETE', headers: headers() });
  assert.equal(clear.status, 204);
  cart = await getCart();
  assert.equal(cart.items.length, 0);
  assert.equal(cart.currency, null);
});
