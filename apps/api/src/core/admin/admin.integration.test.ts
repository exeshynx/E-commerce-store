import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { after, before, test } from 'node:test';
import type {
  AdminCategoryListData,
  AdminDashboardData,
  AdminInventoryListData,
  AdminOrderDetailData,
  AdminOrderListData,
  AdminProductDetailData,
  AdminProductListData,
  AdminSystemOverviewData,
  AdminUserListData,
  ApiSuccess,
  AuthSessionData,
} from '@veyora/contracts';
import { Prisma } from '@prisma/client';
import { createApp } from '../../app.js';
import { prisma } from '../../infrastructure/database/prisma.js';
import { cleanupOperationalRecords } from '../../test/test-data-cleanup.js';
import { passwordService } from '../auth/password.service.js';

const password = 'StrongPassword123';
const adminEmail = 'management.admin@veyora.test';
const customerEmail = 'management.customer@veyora.test';
const testEmails = [adminEmail, customerEmail];
const categorySlug = 'management-integration-category';
const productSku = 'MANAGEMENT-TEST-001';
const server = createServer(createApp());
let baseUrl = '';
let adminToken = '';
let customerToken = '';
let adminId = '';
let categoryId = '';
let productId = '';
let orderId = '';

const cleanup = async () => {
  await cleanupOperationalRecords(testEmails);
  await prisma.orderStatusHistory.deleteMany({
    where: { order: { user: { email: { in: testEmails } } } },
  });
  await prisma.order.deleteMany({ where: { user: { email: { in: testEmails } } } });
  await prisma.user.deleteMany({ where: { email: { in: testEmails } } });
  await prisma.product.deleteMany({ where: { sku: productSku } });
  await prisma.category.deleteMany({ where: { slug: categorySlug } });
};

const login = async (email: string) => {
  const response = await fetch(`${baseUrl}/auth/login`, {
    body: JSON.stringify({ email, password }),
    headers: { 'content-type': 'application/json' },
    method: 'POST',
  });
  assert.equal(response.status, 200);
  return ((await response.json()) as ApiSuccess<AuthSessionData>).data.accessToken;
};

const headers = (token = adminToken) => ({
  authorization: `Bearer ${token}`,
  'content-type': 'application/json',
});

const errorCode = async (response: Response) =>
  ((await response.json()) as { error: { code: string } }).error.code;

before(async () => {
  await cleanup();
  const passwordHash = await passwordService.hash(password);
  const [admin, customer] = await Promise.all([
    prisma.user.create({
      data: {
        email: adminEmail,
        firstName: 'Management',
        lastName: 'Administrator',
        passwordHash,
        role: 'ADMIN',
      },
    }),
    prisma.user.create({
      data: {
        email: customerEmail,
        firstName: 'Management',
        lastName: 'Customer',
        passwordHash,
      },
    }),
  ]);
  adminId = admin.id;
  const category = await prisma.category.create({
    data: { name: 'Management Integration Category', slug: categorySlug },
  });
  categoryId = category.id;
  const product = await prisma.product.create({
    data: {
      categoryId,
      description: 'A product used to validate the administration foundation.',
      inventory: { create: { availableQuantity: 3, reservedQuantity: 1 } },
      name: 'Management Integration Product',
      price: new Prisma.Decimal('4500.00'),
      sku: productSku,
      slug: 'management-integration-product',
    },
  });
  productId = product.id;
  const order = await prisma.order.create({
    data: {
      checkoutFingerprint: 'a'.repeat(64),
      currency: 'PKR',
      idempotencyKey: 'management-integration-key',
      items: {
        create: {
          currency: 'PKR',
          lineSubtotal: new Prisma.Decimal('9000.00'),
          productId,
          productName: product.name,
          quantity: 2,
          sku: product.sku,
          unitPrice: product.price,
        },
      },
      orderNumber: 'AUR-MANAGEMENT-TEST',
      shippingAddress: {
        create: {
          address: '18 Test Street',
          city: 'Lahore',
          country: 'Pakistan',
          email: customer.email,
          fullName: 'Management Customer',
          phone: '+92 300 1000000',
          postalCode: '54000',
          province: 'Punjab',
        },
      },
      subtotal: new Prisma.Decimal('9000.00'),
      total: new Prisma.Decimal('9000.00'),
      userId: customer.id,
    },
  });
  orderId = order.id;

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  baseUrl = `http://127.0.0.1:${address.port}/api/v1`;
  [adminToken, customerToken] = await Promise.all([login(adminEmail), login(customerEmail)]);
});

after(async () => {
  await cleanup();
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
  await prisma.$disconnect();
});

void test('admin dashboard, store management, authorization, orders, and audit trail', async () => {
  const unauthenticated = await fetch(`${baseUrl}/admin/dashboard`);
  assert.equal(unauthenticated.status, 401);

  const forbidden = await fetch(`${baseUrl}/admin/dashboard`, {
    headers: headers(customerToken),
  });
  assert.equal(forbidden.status, 403);

  const dashboardResponse = await fetch(`${baseUrl}/admin/dashboard`, {
    headers: headers(),
  });
  assert.equal(dashboardResponse.status, 200);
  const dashboard = ((await dashboardResponse.json()) as ApiSuccess<AdminDashboardData>).data;
  assert.ok(dashboard.metrics.totalUsers >= 2);
  assert.ok(dashboard.metrics.totalProducts >= 1);
  assert.ok(dashboard.metrics.totalOrders >= 1);
  assert.ok(dashboard.recentOrders.length <= 5);

  const productListResponse = await fetch(
    `${baseUrl}/admin/products?q=MANAGEMENT-TEST&page=1&pageSize=10`,
    { headers: headers() },
  );
  assert.equal(productListResponse.status, 200);
  const products = ((await productListResponse.json()) as ApiSuccess<AdminProductListData>).data;
  assert.equal(products.items.length, 1);
  assert.equal(products.items[0]?.inventory.availableQuantity, 2);

  const productDetailResponse = await fetch(`${baseUrl}/admin/products/${productId}`, {
    headers: headers(),
  });
  assert.equal(productDetailResponse.status, 200);
  const productDetail = ((await productDetailResponse.json()) as ApiSuccess<AdminProductDetailData>)
    .data.product;
  assert.equal(productDetail.description.startsWith('A product used'), true);

  const categoryListResponse = await fetch(
    `${baseUrl}/admin/categories?q=management&page=1&pageSize=10`,
    { headers: headers() },
  );
  assert.equal(categoryListResponse.status, 200);
  const categories = ((await categoryListResponse.json()) as ApiSuccess<AdminCategoryListData>)
    .data;
  assert.equal(categories.items[0]?.productCount, 1);
  assert.equal(categories.items[0]?.activeProductCount, 1);

  const archiveProduct = await fetch(`${baseUrl}/admin/products/${productId}`, {
    headers: headers(),
    method: 'DELETE',
  });
  assert.equal(archiveProduct.status, 204);
  const restoreProduct = await fetch(`${baseUrl}/admin/products/${productId}/restore`, {
    headers: headers(),
    method: 'PATCH',
  });
  assert.equal(restoreProduct.status, 200);

  const archiveCategory = await fetch(`${baseUrl}/admin/categories/${categoryId}`, {
    headers: headers(),
    method: 'DELETE',
  });
  assert.equal(archiveCategory.status, 204);
  const restoreCategory = await fetch(`${baseUrl}/admin/categories/${categoryId}/restore`, {
    headers: headers(),
    method: 'PATCH',
  });
  assert.equal(restoreCategory.status, 200);

  const inventoryListResponse = await fetch(
    `${baseUrl}/admin/inventory?q=MANAGEMENT-TEST&stock=low_stock`,
    { headers: headers() },
  );
  assert.equal(inventoryListResponse.status, 200);
  const inventory = ((await inventoryListResponse.json()) as ApiSuccess<AdminInventoryListData>)
    .data;
  assert.equal(inventory.items[0]?.inventory.stockStatus, 'LOW_STOCK');

  const invalidJson = await fetch(`${baseUrl}/admin/inventory/${productId}`, {
    body: '{',
    headers: headers(),
    method: 'PATCH',
  });
  assert.equal(invalidJson.status, 400);
  assert.equal(await errorCode(invalidJson), 'INVALID_JSON');

  const belowReserved = await fetch(`${baseUrl}/admin/inventory/${productId}`, {
    body: JSON.stringify({ totalQuantity: 0 }),
    headers: headers(),
    method: 'PATCH',
  });
  assert.equal(belowReserved.status, 409);
  assert.equal(await errorCode(belowReserved), 'INVENTORY_BELOW_RESERVED');

  const inventoryUpdate = await fetch(`${baseUrl}/admin/inventory/${productId}`, {
    body: JSON.stringify({ totalQuantity: 5 }),
    headers: headers(),
    method: 'PATCH',
  });
  assert.equal(inventoryUpdate.status, 200);

  const orderListResponse = await fetch(
    `${baseUrl}/admin/orders?q=AUR-MANAGEMENT&page=1&pageSize=10`,
    { headers: headers() },
  );
  assert.equal(orderListResponse.status, 200);
  const orders = ((await orderListResponse.json()) as ApiSuccess<AdminOrderListData>).data;
  assert.equal(orders.items[0]?.id, orderId);
  assert.equal(orders.items[0]?.itemCount, 1);

  const invalidStatus = await fetch(`${baseUrl}/admin/orders/${orderId}/status`, {
    body: JSON.stringify({ status: 'SHIPPED' }),
    headers: headers(),
    method: 'PATCH',
  });
  assert.equal(invalidStatus.status, 409);
  assert.equal(await errorCode(invalidStatus), 'INVALID_ORDER_STATUS_TRANSITION');

  const concurrentTransition = () =>
    fetch(`${baseUrl}/admin/orders/${orderId}/status`, {
      body: JSON.stringify({ note: 'Payment review started.', status: 'AWAITING_PAYMENT' }),
      headers: headers(),
      method: 'PATCH',
    });
  const transitionResponses = await Promise.all([concurrentTransition(), concurrentTransition()]);
  assert.deepEqual(transitionResponses.map((response) => response.status).sort(), [200, 409]);

  const processing = await fetch(`${baseUrl}/admin/orders/${orderId}/status`, {
    body: JSON.stringify({ status: 'PROCESSING' }),
    headers: headers(),
    method: 'PATCH',
  });
  assert.equal(processing.status, 409);
  assert.equal(await errorCode(processing), 'ORDER_PAYMENT_REQUIRED');

  const beforeCancellation = await prisma.inventory.findUniqueOrThrow({ where: { productId } });
  const cancellation = await fetch(`${baseUrl}/admin/orders/${orderId}/status`, {
    body: JSON.stringify({ note: 'Customer requested cancellation.', status: 'CANCELLED' }),
    headers: headers(),
    method: 'PATCH',
  });
  assert.equal(cancellation.status, 200);
  const cancelledOrder = ((await cancellation.json()) as ApiSuccess<AdminOrderDetailData>).data
    .order;
  assert.equal(cancelledOrder.status, 'CANCELLED');
  assert.equal(cancelledOrder.statusHistory.length, 2);
  assert.equal(cancelledOrder.statusHistory[0]?.administrator?.id, adminId);
  const afterCancellation = await prisma.inventory.findUniqueOrThrow({ where: { productId } });
  assert.equal(
    afterCancellation.availableQuantity,
    beforeCancellation.availableQuantity + 2,
    'cancellation must restore purchased inventory exactly once',
  );

  const terminalTransition = await fetch(`${baseUrl}/admin/orders/${orderId}/status`, {
    body: JSON.stringify({ status: 'PENDING' }),
    headers: headers(),
    method: 'PATCH',
  });
  assert.equal(terminalTransition.status, 409);

  const orderDetailResponse = await fetch(`${baseUrl}/admin/orders/${orderId}`, {
    headers: headers(),
  });
  assert.equal(orderDetailResponse.status, 200);
  const orderDetail = ((await orderDetailResponse.json()) as ApiSuccess<AdminOrderDetailData>).data
    .order;
  assert.equal(orderDetail.shippingAddress?.city, 'Lahore');
  assert.equal(orderDetail.items[0]?.sku, productSku);

  const usersResponse = await fetch(
    `${baseUrl}/admin/users?q=management.customer&role=CUSTOMER&page=1&pageSize=10`,
    { headers: headers() },
  );
  assert.equal(usersResponse.status, 200);
  const users = ((await usersResponse.json()) as ApiSuccess<AdminUserListData>).data;
  assert.equal(users.items[0]?.email, customerEmail);
  assert.equal(users.items[0]?.orderCount, 1);

  const systemResponse = await fetch(`${baseUrl}/admin/system`, { headers: headers() });
  assert.equal(systemResponse.status, 200);
  const system = ((await systemResponse.json()) as ApiSuccess<AdminSystemOverviewData>).data;
  assert.equal(system.database, 'ready');
  assert.equal(system.service, 'veyora-api');
});
