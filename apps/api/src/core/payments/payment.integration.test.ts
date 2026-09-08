import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { after, before, test } from 'node:test';
import type {
  AdminPaymentListData,
  ApiSuccess,
  AuthSessionData,
  OrderPaymentHistoryData,
  PaymentAttemptData,
} from '@veyora/contracts';
import { Prisma } from '@prisma/client';
import { createApp } from '../../app.js';
import { prisma } from '../../infrastructure/database/prisma.js';
import { cleanupOperationalRecords } from '../../test/test-data-cleanup.js';
import { passwordService } from '../auth/password.service.js';
import { webhookEventService } from './webhook-event.service.js';

const password = 'StrongPassword123';
const adminEmail = 'payment.admin@veyora.test';
const customerEmail = 'payment.customer@veyora.test';
const otherCustomerEmail = 'payment.other-customer@veyora.test';
const testEmails = [adminEmail, customerEmail, otherCustomerEmail];
const webhookExternalEventId = 'payment-foundation-event-001';
const server = createServer(createApp());
let baseUrl = '';
let adminId = '';
let customerOrderId = '';
let otherCustomerOrderId = '';
const accessTokens = new Map<string, string>();

const cleanup = async () => {
  await cleanupOperationalRecords(testEmails);
  await prisma.paymentWebhookEvent.deleteMany({
    where: { externalEventId: webhookExternalEventId },
  });
  await prisma.paymentAttempt.deleteMany({
    where: { order: { user: { email: { in: testEmails } } } },
  });
  await prisma.orderStatusHistory.deleteMany({
    where: { order: { user: { email: { in: testEmails } } } },
  });
  await prisma.order.deleteMany({ where: { user: { email: { in: testEmails } } } });
  await prisma.user.deleteMany({ where: { email: { in: testEmails } } });
};

const headers = (email: string) => ({
  authorization: `Bearer ${accessTokens.get(email) ?? ''}`,
  'content-type': 'application/json',
});

const login = async (email: string) => {
  const response = await fetch(`${baseUrl}/auth/login`, {
    body: JSON.stringify({ email, password }),
    headers: { 'content-type': 'application/json' },
    method: 'POST',
  });
  assert.equal(response.status, 200);
  const payload = (await response.json()) as ApiSuccess<AuthSessionData>;
  accessTokens.set(email, payload.data.accessToken);
};

const createOrder = (userId: string, suffix: string) =>
  prisma.order.create({
    data: {
      checkoutFingerprint: suffix.padEnd(64, 'f').slice(0, 64),
      currency: 'PKR',
      idempotencyKey: `payment-foundation-${suffix}`,
      orderNumber: `AUR-PAYMENT-${suffix}`,
      status: 'AWAITING_PAYMENT',
      subtotal: new Prisma.Decimal('12500.00'),
      total: new Prisma.Decimal('12500.00'),
      userId,
    },
  });

const errorCode = async (response: Response) =>
  ((await response.json()) as { error: { code: string } }).error.code;

before(async () => {
  await cleanup();
  const passwordHash = await passwordService.hash(password);
  const [admin, customer, otherCustomer] = await Promise.all([
    prisma.user.create({
      data: {
        email: adminEmail,
        firstName: 'Payment',
        lastName: 'Administrator',
        passwordHash,
        role: 'ADMIN',
      },
    }),
    prisma.user.create({
      data: {
        email: customerEmail,
        firstName: 'Payment',
        lastName: 'Customer',
        passwordHash,
      },
    }),
    prisma.user.create({
      data: {
        email: otherCustomerEmail,
        firstName: 'Other',
        lastName: 'Customer',
        passwordHash,
      },
    }),
  ]);
  adminId = admin.id;
  const [customerOrder, otherCustomerOrder] = await Promise.all([
    createOrder(customer.id, 'CUSTOMER'),
    createOrder(otherCustomer.id, 'OTHER'),
  ]);
  customerOrderId = customerOrder.id;
  otherCustomerOrderId = otherCustomerOrder.id;

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  baseUrl = `http://127.0.0.1:${address.port}/api/v1`;
  await Promise.all(testEmails.map(login));
});

after(async () => {
  await cleanup();
  server.closeAllConnections();
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
  await prisma.$disconnect();
});

void test('payment authorization, append-oriented attempts, settlement, and webhook idempotency', async () => {
  const unauthenticated = await fetch(`${baseUrl}/orders/${customerOrderId}/payments`);
  assert.equal(unauthenticated.status, 401);

  const forbiddenCustomerHistory = await fetch(
    `${baseUrl}/orders/${otherCustomerOrderId}/payments`,
    { headers: headers(customerEmail) },
  );
  assert.equal(forbiddenCustomerHistory.status, 404);

  const forbiddenAdminList = await fetch(`${baseUrl}/admin/payments`, {
    headers: headers(customerEmail),
  });
  assert.equal(forbiddenAdminList.status, 403);

  const initiateFirstAttempt = () =>
    fetch(`${baseUrl}/orders/${customerOrderId}/payments/manual`, {
      headers: headers(customerEmail),
      method: 'POST',
    });
  const initiationResponses = await Promise.all([initiateFirstAttempt(), initiateFirstAttempt()]);
  assert.deepEqual(initiationResponses.map((response) => response.status).sort(), [201, 409]);
  const firstAttemptResponse = initiationResponses.find((response) => response.status === 201);
  const duplicateActiveAttempt = initiationResponses.find((response) => response.status === 409);
  assert.ok(firstAttemptResponse);
  assert.ok(duplicateActiveAttempt);
  assert.equal(firstAttemptResponse.status, 201);
  const firstAttempt = ((await firstAttemptResponse.json()) as ApiSuccess<PaymentAttemptData>).data;
  assert.equal(firstAttempt.payment.status, 'PENDING');
  assert.equal(firstAttempt.payment.amount, '12500.00');
  assert.equal(firstAttempt.payment.currency, 'PKR');

  assert.equal(duplicateActiveAttempt.status, 409);
  assert.equal(await errorCode(duplicateActiveAttempt), 'PAYMENT_ATTEMPT_ACTIVE');

  const unpaidProcessing = await fetch(`${baseUrl}/admin/orders/${customerOrderId}/status`, {
    body: JSON.stringify({ status: 'PROCESSING' }),
    headers: headers(adminEmail),
    method: 'PATCH',
  });
  assert.equal(unpaidProcessing.status, 409);
  assert.equal(await errorCode(unpaidProcessing), 'ORDER_PAYMENT_REQUIRED');

  const failedResponse = await fetch(
    `${baseUrl}/admin/payments/${firstAttempt.payment.id}/status`,
    {
      body: JSON.stringify({
        failureReason: 'Development payment was declined.',
        status: 'FAILED',
      }),
      headers: headers(adminEmail),
      method: 'PATCH',
    },
  );
  assert.equal(failedResponse.status, 200);
  const failedAttempt = ((await failedResponse.json()) as ApiSuccess<PaymentAttemptData>).data;
  assert.equal(failedAttempt.payment.status, 'FAILED');
  assert.equal(failedAttempt.orderStatus, 'AWAITING_PAYMENT');
  assert.equal(failedAttempt.payment.failureReason, 'Development payment was declined.');

  const secondAttemptResponse = await fetch(
    `${baseUrl}/orders/${customerOrderId}/payments/manual`,
    { headers: headers(customerEmail), method: 'POST' },
  );
  assert.equal(secondAttemptResponse.status, 201);
  const secondAttempt = ((await secondAttemptResponse.json()) as ApiSuccess<PaymentAttemptData>)
    .data;
  assert.notEqual(secondAttempt.payment.id, firstAttempt.payment.id);

  const successResponse = await fetch(
    `${baseUrl}/admin/payments/${secondAttempt.payment.id}/status`,
    {
      body: JSON.stringify({ status: 'SUCCEEDED' }),
      headers: headers(adminEmail),
      method: 'PATCH',
    },
  );
  assert.equal(successResponse.status, 200);
  const successfulAttempt = ((await successResponse.json()) as ApiSuccess<PaymentAttemptData>).data;
  assert.equal(successfulAttempt.payment.status, 'SUCCEEDED');
  assert.equal(successfulAttempt.orderStatus, 'PROCESSING');

  const customerHistoryResponse = await fetch(`${baseUrl}/orders/${customerOrderId}/payments`, {
    headers: headers(customerEmail),
  });
  assert.equal(customerHistoryResponse.status, 200);
  const customerHistory = (
    (await customerHistoryResponse.json()) as ApiSuccess<OrderPaymentHistoryData>
  ).data;
  assert.equal(customerHistory.items.length, 2);
  assert.deepEqual(
    new Set(customerHistory.items.map((attempt) => attempt.status)),
    new Set(['FAILED', 'SUCCEEDED']),
  );

  const adminOrderHistoryResponse = await fetch(
    `${baseUrl}/admin/orders/${customerOrderId}/payments`,
    { headers: headers(adminEmail) },
  );
  assert.equal(adminOrderHistoryResponse.status, 200);

  const adminListResponse = await fetch(
    `${baseUrl}/admin/payments?q=AUR-PAYMENT-CUSTOMER&provider=MANUAL&page=1&pageSize=10`,
    { headers: headers(adminEmail) },
  );
  assert.equal(adminListResponse.status, 200);
  const adminPayments = ((await adminListResponse.json()) as ApiSuccess<AdminPaymentListData>).data;
  assert.equal(adminPayments.items.length, 2);
  assert.ok(adminPayments.items.every((payment) => payment.order.id === customerOrderId));

  const order = await prisma.order.findUniqueOrThrow({ where: { id: customerOrderId } });
  assert.equal(order.status, 'PROCESSING');
  const statusHistory = await prisma.orderStatusHistory.findMany({
    where: { orderId: customerOrderId },
  });
  assert.equal(statusHistory.length, 1);
  assert.equal(statusHistory[0]?.administratorId, adminId);
  assert.equal(statusHistory[0]?.previousStatus, 'AWAITING_PAYMENT');
  assert.equal(statusHistory[0]?.newStatus, 'PROCESSING');

  const duplicateSettlement = await fetch(
    `${baseUrl}/admin/payments/${secondAttempt.payment.id}/status`,
    {
      body: JSON.stringify({ status: 'SUCCEEDED' }),
      headers: headers(adminEmail),
      method: 'PATCH',
    },
  );
  assert.equal(duplicateSettlement.status, 409);
  assert.equal(await errorCode(duplicateSettlement), 'PAYMENT_ATTEMPT_FINALIZED');

  const firstWebhook = await webhookEventService.record({
    eventType: 'payment.test',
    externalEventId: webhookExternalEventId,
    payload: { attemptId: secondAttempt.payment.id },
    provider: 'OTHER',
  });
  const duplicateWebhook = await webhookEventService.record({
    eventType: 'payment.test',
    externalEventId: webhookExternalEventId,
    payload: { redelivery: true },
    provider: 'OTHER',
  });
  assert.equal(firstWebhook.created, true);
  assert.equal(duplicateWebhook.created, false);
  assert.equal(duplicateWebhook.event.id, firstWebhook.event.id);
  assert.equal(
    await prisma.paymentWebhookEvent.count({
      where: { externalEventId: webhookExternalEventId },
    }),
    1,
  );
});
