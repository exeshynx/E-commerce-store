import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { after, before, test } from 'node:test';
import type {
  AccountSummaryData,
  AddressListData,
  AdminCouponListData,
  AdminReviewListData,
  ApiError,
  ApiSuccess,
  AuthSessionData,
  CheckoutData,
  Coupon,
  CouponPreview,
  CustomerAddress,
  ProductReview,
  ProductReviewListData,
  RecommendationData,
  SearchData,
} from '@aurelia/contracts';
import { OrderStatus } from '@prisma/client';
import { createApp } from '../../app.js';
import { prisma } from '../../infrastructure/database/prisma.js';
import { passwordService } from '../auth/password.service.js';

const password = 'StrongPassword123';
const adminEmail = 'experience.admin@aurelia.test';
const buyerEmail = 'experience.buyer@aurelia.test';
const secondBuyerEmail = 'experience.second@aurelia.test';
const otherEmail = 'experience.other@aurelia.test';
const emails = [adminEmail, buyerEmail, secondBuyerEmail, otherEmail];
const skuPrefix = 'EXPERIENCE-';
const couponPrefix = 'EXPERIENCE';
const server = createServer(createApp());
const tokens = new Map<string, string>();
let baseUrl = '';
let buyerId = '';
let secondBuyerId = '';
let firstProductId = '';
let secondProductId = '';
let thirdProductId = '';
let reviewId = '';
let addressId = '';

const request = async <T>(
  path: string,
  options: {
    body?: unknown;
    email?: string;
    headers?: Record<string, string>;
    method?: string;
  } = {},
) => {
  const response = await fetch(`${baseUrl}${path}`, {
    ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
    headers: {
      ...(options.body === undefined ? {} : { 'content-type': 'application/json' }),
      ...(options.email ? { authorization: `Bearer ${tokens.get(options.email)}` } : {}),
      ...options.headers,
    },
    method: options.method ?? 'GET',
  });
  const text = await response.text();
  return { body: (text ? JSON.parse(text) : undefined) as T, status: response.status };
};

const cleanup = async () => {
  await prisma.emailQueueItem.deleteMany({
    where: { order: { user: { email: { in: emails } } } },
  });
  await prisma.adminAuditLog.deleteMany({ where: { administrator: { email: { in: emails } } } });
  await prisma.review.deleteMany({
    where: {
      OR: [{ user: { email: { in: emails } } }, { product: { sku: { startsWith: skuPrefix } } }],
    },
  });
  await prisma.productView.deleteMany({
    where: {
      OR: [{ user: { email: { in: emails } } }, { product: { sku: { startsWith: skuPrefix } } }],
    },
  });
  await prisma.couponUsage.deleteMany({ where: { user: { email: { in: emails } } } });
  await prisma.orderStatusHistory.deleteMany({
    where: { order: { user: { email: { in: emails } } } },
  });
  await prisma.shippingAddressSnapshot.deleteMany({
    where: { order: { user: { email: { in: emails } } } },
  });
  await prisma.orderItem.deleteMany({ where: { order: { user: { email: { in: emails } } } } });
  await prisma.order.deleteMany({ where: { user: { email: { in: emails } } } });
  await prisma.address.deleteMany({ where: { user: { email: { in: emails } } } });
  await prisma.cartItem.deleteMany({ where: { cart: { user: { email: { in: emails } } } } });
  await prisma.cart.deleteMany({ where: { user: { email: { in: emails } } } });
  await prisma.wishlistItem.deleteMany({
    where: { wishlist: { user: { email: { in: emails } } } },
  });
  await prisma.wishlist.deleteMany({ where: { user: { email: { in: emails } } } });
  await prisma.coupon.deleteMany({ where: { code: { startsWith: couponPrefix } } });
  await prisma.inventory.deleteMany({ where: { product: { sku: { startsWith: skuPrefix } } } });
  await prisma.productImage.deleteMany({ where: { product: { sku: { startsWith: skuPrefix } } } });
  await prisma.product.deleteMany({ where: { sku: { startsWith: skuPrefix } } });
  await prisma.category.deleteMany({ where: { slug: 'experience-integration' } });
  await prisma.authSession.deleteMany({ where: { user: { email: { in: emails } } } });
  await prisma.user.deleteMany({ where: { email: { in: emails } } });
};

const login = async (email: string) => {
  const response = await request<ApiSuccess<AuthSessionData>>('/auth/login', {
    body: { email, password },
    method: 'POST',
  });
  assert.equal(response.status, 200);
  tokens.set(email, response.body.data.accessToken);
};

const addToCart = async (email: string, productId: string) => {
  const response = await request('/cart/items', {
    body: { productId, quantity: 1 },
    email,
    method: 'POST',
  });
  assert.equal(response.status, 201);
};

const createAddress = async (email: string, label: string) =>
  request<ApiSuccess<{ address: CustomerAddress }>>('/addresses', {
    body: {
      address: `18 ${label} Street`,
      city: 'Lahore',
      country: 'Pakistan',
      email,
      fullName: 'Experience Customer',
      label,
      phone: '+92 300 1234567',
      postalCode: '54660',
      province: 'Punjab',
    },
    email,
    method: 'POST',
  });

before(async () => {
  await cleanup();
  const passwordHash = await passwordService.hash(password);
  const [admin, buyer, secondBuyer] = await Promise.all([
    prisma.user.create({
      data: {
        email: adminEmail,
        firstName: 'Experience',
        lastName: 'Admin',
        passwordHash,
        role: 'ADMIN',
      },
    }),
    prisma.user.create({
      data: { email: buyerEmail, firstName: 'Verified', lastName: 'Buyer', passwordHash },
    }),
    prisma.user.create({
      data: { email: secondBuyerEmail, firstName: 'Second', lastName: 'Buyer', passwordHash },
    }),
    prisma.user.create({
      data: { email: otherEmail, firstName: 'Other', lastName: 'Customer', passwordHash },
    }),
  ]);
  void admin;
  buyerId = buyer.id;
  secondBuyerId = secondBuyer.id;
  const category = await prisma.category.create({
    data: { name: 'Experience Integration', slug: 'experience-integration' },
  });
  const products = await Promise.all([
    prisma.product.create({
      data: {
        categoryId: category.id,
        currency: 'PKR',
        description: 'A featured review and search test product.',
        inventory: { create: { availableQuantity: 30 } },
        isFeatured: true,
        name: 'Experience Discovery Ring',
        price: '2000.00',
        sku: `${skuPrefix}001`,
        slug: 'experience-discovery-ring',
      },
    }),
    prisma.product.create({
      data: {
        categoryId: category.id,
        currency: 'PKR',
        description: 'An archived but historically reviewable product.',
        inventory: { create: { availableQuantity: 10 } },
        name: 'Experience Archive Necklace',
        price: '3500.00',
        sku: `${skuPrefix}002`,
        slug: 'experience-archive-necklace',
      },
    }),
    prisma.product.create({
      data: {
        categoryId: category.id,
        currency: 'PKR',
        description: 'A related product used for recommendations.',
        inventory: { create: { availableQuantity: 30 } },
        name: 'Experience Related Earrings',
        price: '1500.00',
        sku: `${skuPrefix}003`,
        slug: 'experience-related-earrings',
      },
    }),
  ]);
  firstProductId = products[0].id;
  secondProductId = products[1].id;
  thirdProductId = products[2].id;
  await prisma.order.create({
    data: {
      checkoutFingerprint: 'e'.repeat(64),
      currency: 'PKR',
      idempotencyKey: 'experience-delivered-one',
      orderNumber: 'AUR-EXPERIENCE-1',
      status: OrderStatus.DELIVERED,
      subtotal: '5500.00',
      total: '5500.00',
      userId: buyer.id,
      items: {
        create: [
          {
            currency: 'PKR',
            lineSubtotal: '2000.00',
            productId: products[0].id,
            productName: products[0].name,
            quantity: 1,
            sku: products[0].sku,
            unitPrice: '2000.00',
          },
          {
            currency: 'PKR',
            lineSubtotal: '3500.00',
            productId: products[1].id,
            productName: products[1].name,
            quantity: 1,
            sku: products[1].sku,
            unitPrice: '3500.00',
          },
        ],
      },
    },
  });
  await prisma.order.create({
    data: {
      checkoutFingerprint: 'f'.repeat(64),
      currency: 'PKR',
      idempotencyKey: 'experience-delivered-two',
      orderNumber: 'AUR-EXPERIENCE-2',
      status: OrderStatus.DELIVERED,
      subtotal: '1500.00',
      total: '1500.00',
      userId: secondBuyer.id,
      items: {
        create: {
          currency: 'PKR',
          lineSubtotal: '1500.00',
          productId: products[2].id,
          productName: products[2].name,
          quantity: 1,
          sku: products[2].sku,
          unitPrice: '1500.00',
        },
      },
    },
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Test server did not start.');
  baseUrl = `http://127.0.0.1:${address.port}/api/v1`;
  for (const email of emails) await login(email);
});

after(async () => {
  server.closeAllConnections();
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
  await cleanup();
  await prisma.$disconnect();
});

void test('reviews require a verified purchase, enforce ownership and uniqueness, and support moderation', async () => {
  const unauthenticated = await request<ApiError>(`/products/${firstProductId}/reviews`, {
    body: { body: 'A thoughtful verified review.', rating: 5 },
    method: 'POST',
  });
  assert.equal(unauthenticated.status, 401);
  const unverified = await request<ApiError>(`/products/${firstProductId}/reviews`, {
    body: { body: 'I did not purchase this product.', rating: 4 },
    email: otherEmail,
    method: 'POST',
  });
  assert.equal(unverified.status, 403);
  assert.equal(unverified.body.error.code, 'REVIEW_VERIFIED_PURCHASE_REQUIRED');
  const created = await request<ApiSuccess<{ review: ProductReview }>>(
    `/products/${firstProductId}/reviews`,
    {
      body: { body: 'The finish and fit are excellent.', rating: 5, title: 'Beautiful piece' },
      email: buyerEmail,
      method: 'POST',
    },
  );
  assert.equal(created.status, 201);
  reviewId = created.body.data.review.id;
  assert.equal(created.body.data.review.status, 'PENDING');
  const duplicate = await request<ApiError>(`/products/${firstProductId}/reviews`, {
    body: { body: 'A duplicate review is not allowed.', rating: 4 },
    email: buyerEmail,
    method: 'POST',
  });
  assert.equal(duplicate.status, 409);
  assert.equal(duplicate.body.error.code, 'REVIEW_ALREADY_EXISTS');
  const wrongOwner = await request<ApiError>(`/reviews/${reviewId}`, {
    body: { rating: 1 },
    email: otherEmail,
    method: 'PATCH',
  });
  assert.equal(wrongOwner.status, 404);
  const edited = await request<ApiSuccess<{ review: ProductReview }>>(`/reviews/${reviewId}`, {
    body: { body: 'The finish is excellent and delivery was careful.', rating: 4 },
    email: buyerEmail,
    method: 'PATCH',
  });
  assert.equal(edited.status, 200);
  assert.equal(edited.body.data.review.rating, 4);
  const list = await request<ApiSuccess<AdminReviewListData>>(
    '/admin/reviews?q=Discovery&page=1&pageSize=1',
    { email: adminEmail },
  );
  assert.equal(list.status, 200);
  assert.equal(list.body.data.pagination.totalItems, 1);
  const approved = await request<ApiSuccess<{ review: ProductReview }>>(
    `/admin/reviews/${reviewId}`,
    {
      body: { action: 'approve', note: 'Verified and suitable.' },
      email: adminEmail,
      method: 'PATCH',
    },
  );
  assert.equal(approved.status, 200);
  assert.equal(approved.body.data.review.status, 'APPROVED');
  const publicReviews = await request<ApiSuccess<ProductReviewListData>>(
    `/products/${firstProductId}/reviews?page=1&pageSize=5&sort=highest`,
  );
  assert.equal(publicReviews.status, 200);
  assert.equal(publicReviews.body.data.summary.averageRating, '4.00');
  assert.equal(publicReviews.body.data.summary.totalReviews, 1);
  await prisma.product.update({ data: { isActive: false }, where: { id: secondProductId } });
  const archivedReview = await request<ApiSuccess<{ review: ProductReview }>>(
    `/products/${secondProductId}/reviews`,
    {
      body: { body: 'Historical purchases remain reviewable.', rating: 5 },
      email: buyerEmail,
      method: 'POST',
    },
  );
  assert.equal(archivedReview.status, 201);
});

void test('address CRUD keeps defaults exclusive and saved addresses create immutable checkout snapshots', async () => {
  const first = await createAddress(buyerEmail, 'Home');
  assert.equal(first.status, 201);
  addressId = first.body.data.address.id;
  assert.equal(first.body.data.address.isDefaultShipping, true);
  const second = await createAddress(buyerEmail, 'Office');
  assert.equal(second.status, 201);
  const promoted = await request<ApiSuccess<{ address: CustomerAddress }>>(
    `/addresses/${second.body.data.address.id}`,
    { body: { isDefaultShipping: true }, email: buyerEmail, method: 'PATCH' },
  );
  assert.equal(promoted.status, 200);
  const addresses = await request<ApiSuccess<AddressListData>>('/addresses', { email: buyerEmail });
  assert.equal(addresses.body.data.items.filter((item) => item.isDefaultShipping).length, 1);
  const ownership = await request<ApiError>(`/addresses/${addressId}`, {
    body: { label: 'Stolen' },
    email: otherEmail,
    method: 'PATCH',
  });
  assert.equal(ownership.status, 404);
  const coupon = await request<ApiSuccess<{ coupon: Coupon }>>('/admin/coupons', {
    body: {
      code: 'EXPERIENCE20',
      currency: 'PKR',
      maximumUses: 5,
      maximumUsesPerCustomer: 1,
      minimumOrderValue: 1000,
      type: 'PERCENTAGE',
      value: 20,
    },
    email: adminEmail,
    method: 'POST',
  });
  assert.equal(coupon.status, 201);
  const expired = await request<ApiSuccess<{ coupon: Coupon }>>('/admin/coupons', {
    body: {
      code: 'EXPERIENCE-EXPIRED',
      currency: 'PKR',
      expiresAt: new Date(Date.now() - 60_000).toISOString(),
      startsAt: new Date(Date.now() - 120_000).toISOString(),
      type: 'FIXED_AMOUNT',
      value: 100,
    },
    email: adminEmail,
    method: 'POST',
  });
  assert.equal(expired.status, 201);
  await addToCart(buyerEmail, firstProductId);
  const expiredPreview = await request<ApiError>('/coupons/validate', {
    body: { code: 'EXPERIENCE-EXPIRED' },
    email: buyerEmail,
    method: 'POST',
  });
  assert.equal(expiredPreview.status, 409);
  assert.equal(expiredPreview.body.error.code, 'COUPON_EXPIRED');
  const preview = await request<ApiSuccess<{ coupon: CouponPreview }>>('/coupons/validate', {
    body: { code: 'experience20' },
    email: buyerEmail,
    method: 'POST',
  });
  assert.equal(preview.status, 200);
  assert.equal(preview.body.data.coupon.discountAmount, '400.00');
  const checkout = await request<ApiSuccess<CheckoutData>>('/checkout', {
    body: { addressId, couponCode: 'EXPERIENCE20' },
    email: buyerEmail,
    headers: { 'Idempotency-Key': 'experience-address-coupon-0001' },
    method: 'POST',
  });
  assert.equal(checkout.status, 201);
  assert.equal(checkout.body.data.order.discountAmount, '400.00');
  assert.equal(checkout.body.data.order.total, '1600.00');
  assert.equal(checkout.body.data.order.shippingAddress?.address, '18 Home Street');
  const usage = await prisma.couponUsage.findUnique({
    where: { orderId: checkout.body.data.order.id },
  });
  assert.equal(usage?.couponCode, 'EXPERIENCE20');
  assert.equal(usage?.discountAmount.toFixed(2), '400.00');
  await addToCart(buyerEmail, firstProductId);
  const limit = await request<ApiError>('/checkout', {
    body: { addressId, couponCode: 'EXPERIENCE20' },
    email: buyerEmail,
    headers: { 'Idempotency-Key': 'experience-address-coupon-0002' },
    method: 'POST',
  });
  assert.equal(limit.status, 409);
  assert.equal(limit.body.error.code, 'COUPON_CUSTOMER_LIMIT_REACHED');
  await request('/cart', { email: buyerEmail, method: 'DELETE' });
});

void test('global coupon limits remain safe under concurrent checkout attempts', async () => {
  const global = await request<ApiSuccess<{ coupon: Coupon }>>('/admin/coupons', {
    body: {
      code: 'EXPERIENCE-GLOBAL-ONE',
      currency: 'PKR',
      maximumUses: 1,
      maximumUsesPerCustomer: 1,
      type: 'FIXED_AMOUNT',
      value: 100,
    },
    email: adminEmail,
    method: 'POST',
  });
  assert.equal(global.status, 201);
  const secondAddress = await createAddress(secondBuyerEmail, 'Second Home');
  assert.equal(secondAddress.status, 201);
  await Promise.all([
    addToCart(buyerEmail, thirdProductId),
    addToCart(secondBuyerEmail, thirdProductId),
  ]);
  const attempts = await Promise.all([
    request<ApiSuccess<CheckoutData> | ApiError>('/checkout', {
      body: { addressId, couponCode: 'EXPERIENCE-GLOBAL-ONE' },
      email: buyerEmail,
      headers: { 'Idempotency-Key': 'experience-global-checkout-0001' },
      method: 'POST',
    }),
    request<ApiSuccess<CheckoutData> | ApiError>('/checkout', {
      body: { addressId: secondAddress.body.data.address.id, couponCode: 'EXPERIENCE-GLOBAL-ONE' },
      email: secondBuyerEmail,
      headers: { 'Idempotency-Key': 'experience-global-checkout-0002' },
      method: 'POST',
    }),
  ]);
  assert.deepEqual(attempts.map((item) => item.status).sort(), [201, 409]);
  assert.equal(
    await prisma.couponUsage.count({ where: { couponId: global.body.data.coupon.id } }),
    1,
  );
});

void test('search, autocomplete, recommendations, profile summaries, pagination, and audit records work', async () => {
  await prisma.product.update({ data: { isActive: true }, where: { id: secondProductId } });
  const search = await request<ApiSuccess<SearchData>>(
    '/search?q=Discovery&minimumRating=4&availability=in_stock&sort=highest_rated&page=1&pageSize=1',
  );
  assert.equal(search.status, 200);
  assert.equal(search.body.data.items[0]?.id, firstProductId);
  assert.equal(search.body.data.items[0]?.rating.average, '4.00');
  const suggestions = await request<ApiSuccess<{ items: Array<{ id: string }> }>>(
    '/search/suggestions?q=Exper&limit=2',
  );
  assert.equal(suggestions.status, 200);
  assert.equal(suggestions.body.data.items.length, 2);
  const featured = await request<ApiSuccess<RecommendationData>>(
    '/recommendations?type=featured&limit=5',
  );
  assert.ok(featured.body.data.items.some((item) => item.id === firstProductId));
  const related = await request<ApiSuccess<RecommendationData>>(
    `/recommendations?type=related&productId=${firstProductId}&limit=5`,
  );
  assert.ok(related.body.data.items.some((item) => item.id === thirdProductId));
  const view = await request(`/products/${firstProductId}/view`, {
    email: buyerEmail,
    method: 'POST',
  });
  assert.equal(view.status, 204);
  const recent = await request<ApiSuccess<RecommendationData>>(
    '/recommendations?type=recently_viewed',
    { email: buyerEmail },
  );
  assert.equal(recent.body.data.items[0]?.id, firstProductId);
  const profile = await request<ApiSuccess<{ user: { firstName: string; phone: string | null } }>>(
    '/account/profile',
    {
      body: { firstName: 'Updated', phone: '+92 311 7654321' },
      email: buyerEmail,
      method: 'PATCH',
    },
  );
  assert.equal(profile.body.data.user.firstName, 'Updated');
  const summary = await request<ApiSuccess<AccountSummaryData>>('/account/summary', {
    email: buyerEmail,
  });
  assert.equal(summary.status, 200);
  assert.ok(summary.body.data.stats.deliveredOrderCount >= 1);
  assert.ok(summary.body.data.stats.addressCount >= 2);
  const coupons = await request<ApiSuccess<AdminCouponListData>>(
    '/admin/coupons?q=EXPERIENCE&page=1&pageSize=2',
    { email: adminEmail },
  );
  assert.equal(coupons.status, 200);
  assert.ok(coupons.body.data.pagination.totalItems >= 3);
  const featureUpdate = await request(`/admin/products/${thirdProductId}/featured`, {
    body: { isFeatured: true },
    email: adminEmail,
    method: 'PATCH',
  });
  assert.equal(featureUpdate.status, 200);
  const audits = await prisma.adminAuditLog.count({
    where: { administrator: { email: adminEmail }, entityType: { in: ['COUPON', 'REVIEW'] } },
  });
  assert.ok(audits >= 4);
  assert.equal(await prisma.productView.count({ where: { userId: buyerId } }), 1);
  assert.equal(await prisma.user.count({ where: { id: secondBuyerId } }), 1);
});
