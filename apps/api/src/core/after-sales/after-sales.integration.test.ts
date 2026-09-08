import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { after, before, test } from 'node:test';
import type {
  ApiError,
  ApiSuccess,
  AuthSessionData,
  ReturnDetailData,
  ReturnListData,
  SupportTicketDetailData,
  SupportTicketListData,
} from '@veyora/contracts';
import {
  AdminAuditEntityType,
  EmailNotificationType,
  OrderStatus,
  PaymentProvider,
  PaymentStatus,
  ReturnStatus,
  SupportTicketPriority,
  SupportTicketStatus,
} from '@prisma/client';
import { createApp } from '../../app.js';
import { prisma } from '../../infrastructure/database/prisma.js';
import { cleanupAfterSalesRecords } from '../../test/test-data-cleanup.js';
import { passwordService } from '../auth/password.service.js';

const password = 'StrongPassword123';
const adminEmail = 'after-sales.admin@veyora.test';
const customerEmail = 'after-sales.customer@veyora.test';
const otherEmail = 'after-sales.other@veyora.test';
const emails = [adminEmail, customerEmail, otherEmail];
const server = createServer(createApp());
const tokens = new Map<string, string>();
let baseUrl = '';
let adminId = '';
let orderId = '';
let orderItemId = '';
let expiredOrderId = '';
let returnId = '';
let ticketId = '';
let paymentId = '';
let categoryId = '';
let productId = '';

const request = async <T>(
  path: string,
  options: { body?: unknown; email?: string; method?: string } = {},
) => {
  const response = await fetch(`${baseUrl}${path}`, {
    ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
    headers: {
      ...(options.body === undefined ? {} : { 'content-type': 'application/json' }),
      ...(options.email ? { authorization: `Bearer ${tokens.get(options.email)}` } : {}),
    },
    method: options.method ?? 'GET',
  });
  return { body: (await response.json()) as T, status: response.status };
};

const cleanup = async () => {
  await cleanupAfterSalesRecords(emails);
  const userFilter = { email: { in: emails } };
  await prisma.paymentRefund.deleteMany({
    where: { paymentAttempt: { order: { user: userFilter } } },
  });
  await prisma.paymentWebhookEvent.deleteMany({
    where: { paymentAttempt: { order: { user: userFilter } } },
  });
  await prisma.paymentAttempt.deleteMany({ where: { order: { user: userFilter } } });
  await prisma.shipmentEvent.deleteMany({
    where: { shipment: { order: { user: userFilter } } },
  });
  await prisma.shipment.deleteMany({ where: { order: { user: userFilter } } });
  await prisma.orderStatusHistory.deleteMany({ where: { order: { user: userFilter } } });
  await prisma.shippingAddressSnapshot.deleteMany({ where: { order: { user: userFilter } } });
  await prisma.orderItem.deleteMany({ where: { order: { user: userFilter } } });
  await prisma.order.deleteMany({ where: { user: userFilter } });
  await prisma.inventory.deleteMany({
    where: { product: { sku: { startsWith: 'AFTER-SALES-' } } },
  });
  await prisma.productImage.deleteMany({
    where: { product: { sku: { startsWith: 'AFTER-SALES-' } } },
  });
  await prisma.product.deleteMany({ where: { sku: { startsWith: 'AFTER-SALES-' } } });
  await prisma.category.deleteMany({ where: { slug: 'after-sales-test' } });
  await prisma.authSession.deleteMany({ where: { user: { email: { in: emails } } } });
  await prisma.user.deleteMany({ where: { email: { in: emails } } });
};

before(async () => {
  await cleanup();
  const passwordHash = await passwordService.hash(password);
  const [admin, customer] = await Promise.all([
    prisma.user.create({
      data: {
        email: adminEmail,
        firstName: 'After',
        lastName: 'Admin',
        passwordHash,
        role: 'ADMIN',
      },
    }),
    prisma.user.create({
      data: { email: customerEmail, firstName: 'Return', lastName: 'Customer', passwordHash },
    }),
    prisma.user.create({
      data: { email: otherEmail, firstName: 'Other', lastName: 'Customer', passwordHash },
    }),
  ]);
  adminId = admin.id;
  const category = await prisma.category.create({
    data: { name: 'After Sales Test', slug: 'after-sales-test' },
  });
  categoryId = category.id;
  const product = await prisma.product.create({
    data: {
      categoryId,
      currency: 'PKR',
      description: 'Return integration test product.',
      name: 'After Sales Product',
      price: '1000.00',
      sku: 'AFTER-SALES-001',
      slug: 'after-sales-product',
    },
  });
  productId = product.id;
  const delivered = await prisma.order.create({
    data: {
      checkoutFingerprint: 'a'.repeat(64),
      currency: 'PKR',
      idempotencyKey: 'after-sales-delivered',
      orderNumber: 'AUR-AFTER-SALES-1',
      status: OrderStatus.DELIVERED,
      subtotal: '3000.00',
      total: '3000.00',
      userId: customer.id,
      items: {
        create: [
          {
            currency: 'PKR',
            lineSubtotal: '3000.00',
            productId,
            productName: product.name,
            quantity: 3,
            sku: product.sku,
            unitPrice: '1000.00',
          },
        ],
      },
      shipment: {
        create: {
          courier: 'TCS',
          deliveredAt: new Date(),
          shippedAt: new Date(Date.now() - 86_400_000),
          status: 'DELIVERED',
          trackingNumber: 'RETURN-ELIGIBLE-1',
        },
      },
      paymentAttempts: {
        create: {
          amount: '3000.00',
          currency: 'PKR',
          provider: PaymentProvider.MANUAL,
          providerPaymentId: 'manual_after_sales_payment',
          status: PaymentStatus.SUCCEEDED,
        },
      },
    },
    include: { items: true, paymentAttempts: true },
  });
  orderId = delivered.id;
  orderItemId = delivered.items[0]!.id;
  paymentId = delivered.paymentAttempts[0]!.id;
  const expired = await prisma.order.create({
    data: {
      checkoutFingerprint: 'b'.repeat(64),
      currency: 'PKR',
      idempotencyKey: 'after-sales-expired',
      orderNumber: 'AUR-AFTER-SALES-2',
      status: OrderStatus.DELIVERED,
      subtotal: '1000.00',
      total: '1000.00',
      userId: customer.id,
      items: {
        create: [
          {
            currency: 'PKR',
            lineSubtotal: '1000.00',
            productId,
            productName: product.name,
            quantity: 1,
            sku: product.sku,
            unitPrice: '1000.00',
          },
        ],
      },
      shipment: {
        create: {
          courier: 'TCS',
          deliveredAt: new Date(Date.now() - 45 * 86_400_000),
          shippedAt: new Date(Date.now() - 46 * 86_400_000),
          status: 'DELIVERED',
          trackingNumber: 'RETURN-EXPIRED-1',
        },
      },
      paymentAttempts: {
        create: {
          amount: '1000.00',
          currency: 'PKR',
          provider: PaymentProvider.MANUAL,
          providerPaymentId: 'manual_after_sales_expired',
          status: PaymentStatus.SUCCEEDED,
        },
      },
    },
  });
  expiredOrderId = expired.id;
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Test server did not start.');
  baseUrl = `http://127.0.0.1:${address.port}/api/v1`;
  for (const email of emails) {
    const login = await request<ApiSuccess<AuthSessionData>>('/auth/login', {
      body: { email, password },
      method: 'POST',
    });
    assert.equal(login.status, 200);
    tokens.set(email, login.body.data.accessToken);
  }
});

after(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
  await cleanup();
  await prisma.$disconnect();
});

void test('returns enforce authentication, ownership, window, quantities, duplicates, and pagination', async () => {
  const unauthenticated = await request<ApiError>('/returns', { body: {}, method: 'POST' });
  assert.equal(unauthenticated.status, 401);
  const wrongOwner = await request<ApiError>('/returns', {
    body: { items: [{ orderItemId, quantity: 1, reason: 'DAMAGED' }], orderId },
    email: otherEmail,
    method: 'POST',
  });
  assert.equal(wrongOwner.status, 404);
  const expired = await request<ApiError>('/returns', {
    body: { items: [{ orderItemId, quantity: 1, reason: 'DAMAGED' }], orderId: expiredOrderId },
    email: customerEmail,
    method: 'POST',
  });
  assert.equal(expired.status, 409);
  assert.equal(expired.body.error.code, 'RETURN_WINDOW_EXPIRED');
  const excessive = await request<ApiError>('/returns', {
    body: { items: [{ orderItemId, quantity: 4, reason: 'DAMAGED' }], orderId },
    email: customerEmail,
    method: 'POST',
  });
  assert.equal(excessive.status, 422);
  const created = await request<ApiSuccess<ReturnDetailData>>('/returns', {
    body: {
      customerNote: 'The clasp arrived broken.',
      items: [{ orderItemId, quantity: 1, reason: 'DAMAGED' }],
      orderId,
    },
    email: customerEmail,
    method: 'POST',
  });
  assert.equal(created.status, 201);
  assert.equal(created.body.data.returnRequest.items[0]?.quantity, 1);
  assert.equal(created.body.data.returnRequest.items[0]?.refundAmount, '1000.00');
  returnId = created.body.data.returnRequest.id;
  const duplicate = await request<ApiError>('/returns', {
    body: { items: [{ orderItemId, quantity: 1, reason: 'DEFECTIVE' }], orderId },
    email: customerEmail,
    method: 'POST',
  });
  assert.equal(duplicate.status, 409);
  assert.equal(duplicate.body.error.code, 'RETURN_ALREADY_ACTIVE');
  const owned = await request<ApiSuccess<ReturnDetailData>>(`/returns/${returnId}`, {
    email: customerEmail,
  });
  const hidden = await request<ApiError>(`/returns/${returnId}`, { email: otherEmail });
  const list = await request<ApiSuccess<ReturnListData>>('/returns?page=1&pageSize=1', {
    email: customerEmail,
  });
  assert.equal(owned.status, 200);
  assert.equal(hidden.status, 404);
  assert.equal(list.body.data.pagination.pageSize, 1);
});

void test('admin RMA lifecycle, tracking, partial refunds, concurrency, notifications, and audits are preserved', async () => {
  const forbidden = await request<ApiError>('/admin/returns', { email: customerEmail });
  assert.equal(forbidden.status, 403);
  const searched = await request<ApiSuccess<ReturnListData>>(
    '/admin/returns?page=1&pageSize=1&q=AUR-AFTER-SALES-1',
    { email: adminEmail },
  );
  assert.equal(searched.status, 200);
  assert.equal(searched.body.data.items.length, 1);
  for (const body of [
    { action: 'APPROVE' },
    { action: 'UPDATE_SHIPMENT', courier: 'Leopards', trackingNumber: 'RMA-TRACK-1' },
    { action: 'ADD_SHIPMENT_EVENT', status: 'SHIPPED' },
    { action: 'ADD_SHIPMENT_EVENT', status: 'IN_TRANSIT' },
    { action: 'ADD_SHIPMENT_EVENT', status: 'DELIVERED' },
    { action: 'RECEIVE_ITEM' },
    { action: 'INSPECT', inspectionNotes: 'Item verified and eligible for refund.' },
  ]) {
    const updated = await request<ApiSuccess<ReturnDetailData>>(`/admin/returns/${returnId}`, {
      body,
      email: adminEmail,
      method: 'PATCH',
    });
    assert.equal(updated.status, 200);
  }
  const partial = await request<ApiSuccess<ReturnDetailData>>(`/admin/returns/${returnId}`, {
    body: {
      action: 'INITIATE_REFUND',
      amount: '400.00',
      idempotencyKey: 'return-partial-refund-0001',
      paymentAttemptId: paymentId,
    },
    email: adminEmail,
    method: 'PATCH',
  });
  assert.equal(partial.status, 200);
  assert.equal(partial.body.data.returnRequest.status, ReturnStatus.REFUND_PENDING);
  const concurrent = await Promise.all([
    request<ApiSuccess<ReturnDetailData> | ApiError>(`/admin/returns/${returnId}`, {
      body: {
        action: 'INITIATE_REFUND',
        amount: '600.00',
        idempotencyKey: 'return-final-refund-0001',
        paymentAttemptId: paymentId,
      },
      email: adminEmail,
      method: 'PATCH',
    }),
    request<ApiSuccess<ReturnDetailData> | ApiError>(`/admin/returns/${returnId}`, {
      body: {
        action: 'INITIATE_REFUND',
        amount: '600.00',
        idempotencyKey: 'return-final-refund-0002',
        paymentAttemptId: paymentId,
      },
      email: adminEmail,
      method: 'PATCH',
    }),
  ]);
  assert.deepEqual(concurrent.map((result) => result.status).sort(), [200, 422]);
  const detail = await request<ApiSuccess<ReturnDetailData>>(`/admin/returns/${returnId}`, {
    email: adminEmail,
  });
  assert.equal(detail.body.data.returnRequest.status, ReturnStatus.REFUNDED);
  assert.equal(detail.body.data.returnRequest.refunds.length, 2);
  assert.equal(detail.body.data.returnRequest.shipment?.events.length, 3);
  const notificationCount = await prisma.emailQueueItem.count({
    where: {
      returnRequestId: returnId,
      notificationType: {
        in: [
          EmailNotificationType.RETURN_REQUESTED,
          EmailNotificationType.RETURN_APPROVED,
          EmailNotificationType.REFUND_COMPLETED,
        ],
      },
    },
  });
  const auditCount = await prisma.adminAuditLog.count({
    where: { entityId: returnId, entityType: AdminAuditEntityType.RETURN_REQUEST },
  });
  assert.equal(notificationCount, 3);
  assert.ok(auditCount >= 5);
});

void test('support tickets enforce ownership and preserve assignment, replies, lifecycle, search, audit, and email history', async () => {
  const unauthenticated = await request<ApiError>('/tickets');
  assert.equal(unauthenticated.status, 401);
  const created = await request<ApiSuccess<SupportTicketDetailData>>('/tickets', {
    body: {
      attachments: [{ fileName: 'receipt.pdf', mediaType: 'application/pdf', sizeBytes: 2048 }],
      body: 'I need help understanding my return.',
      orderId,
      subject: 'Help with delivered order',
    },
    email: customerEmail,
    method: 'POST',
  });
  assert.equal(created.status, 201);
  ticketId = created.body.data.ticket.id;
  assert.equal(created.body.data.ticket.messages[0]?.attachments[0]?.fileName, 'receipt.pdf');
  const hidden = await request<ApiError>(`/tickets/${ticketId}`, { email: otherEmail });
  assert.equal(hidden.status, 404);
  const customerReply = await request<ApiSuccess<SupportTicketDetailData>>(
    `/tickets/${ticketId}/messages`,
    { body: { body: 'Here is one more detail.' }, email: customerEmail, method: 'POST' },
  );
  assert.equal(customerReply.body.data.ticket.messages.length, 2);
  const assigned = await request<ApiSuccess<SupportTicketDetailData>>(
    `/admin/tickets/${ticketId}`,
    {
      body: {
        assignedToId: adminId,
        priority: SupportTicketPriority.HIGH,
        status: SupportTicketStatus.IN_PROGRESS,
      },
      email: adminEmail,
      method: 'PATCH',
    },
  );
  assert.equal(assigned.body.data.ticket.assignedTo?.id, adminId);
  const adminReply = await request<ApiSuccess<SupportTicketDetailData>>(
    `/admin/tickets/${ticketId}/messages`,
    { body: { body: 'We reviewed your order and return.' }, email: adminEmail, method: 'POST' },
  );
  assert.equal(adminReply.body.data.ticket.status, SupportTicketStatus.WAITING_CUSTOMER);
  const resumed = await request<ApiSuccess<SupportTicketDetailData>>(
    `/tickets/${ticketId}/messages`,
    {
      body: { body: 'Thank you, that answers my question.' },
      email: customerEmail,
      method: 'POST',
    },
  );
  assert.equal(resumed.body.data.ticket.status, SupportTicketStatus.IN_PROGRESS);
  const resolved = await request<ApiSuccess<SupportTicketDetailData>>(
    `/admin/tickets/${ticketId}`,
    { body: { status: SupportTicketStatus.RESOLVED }, email: adminEmail, method: 'PATCH' },
  );
  assert.equal(resolved.body.data.ticket.status, SupportTicketStatus.RESOLVED);
  await request<ApiSuccess<SupportTicketDetailData>>(`/admin/tickets/${ticketId}`, {
    body: { status: SupportTicketStatus.CLOSED },
    email: adminEmail,
    method: 'PATCH',
  });
  const closedReply = await request<ApiError>(`/tickets/${ticketId}/messages`, {
    body: { body: 'Cannot append.' },
    email: customerEmail,
    method: 'POST',
  });
  assert.equal(closedReply.status, 409);
  const list = await request<ApiSuccess<SupportTicketListData>>(
    '/admin/tickets?page=1&pageSize=1&q=delivered',
    { email: adminEmail },
  );
  assert.equal(list.body.data.items.length, 1);
  assert.equal(list.body.data.pagination.pageSize, 1);
  const auditCount = await prisma.adminAuditLog.count({
    where: { entityId: ticketId, entityType: AdminAuditEntityType.SUPPORT_TICKET },
  });
  const emailCount = await prisma.emailQueueItem.count({ where: { supportTicketId: ticketId } });
  assert.ok(auditCount >= 5);
  assert.equal(emailCount, 3);
});
