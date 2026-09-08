import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { after, before, test } from 'node:test';
import type {
  AdminAuditListData,
  ApiSuccess,
  AuthSessionData,
  ShipmentData,
  ShipmentTrackingData,
} from '@veyora/contracts';
import {
  OrderStatus,
  PaymentProvider,
  PaymentRefundStatus,
  PaymentStatus,
  PaymentWebhookProcessingStatus,
  Prisma,
  ShipmentStatus,
} from '@prisma/client';
import { createApp } from '../../app.js';
import { env } from '../../config/env.js';
import { prisma } from '../../infrastructure/database/prisma.js';
import { cleanupOperationalRecords } from '../../test/test-data-cleanup.js';
import { passwordService } from '../auth/password.service.js';
import { backgroundJobsService } from '../jobs/background-jobs.service.js';
import type { EmailProvider, SendEmailInput } from '../notifications/email-provider.js';
import { replaceEmailProvider } from '../notifications/email-provider.registry.js';
import { emailQueueService } from '../notifications/email-queue.service.js';
import type { PaymentProviderAdapter } from '../payments/payment-provider.js';
import { replacePaymentProvider } from '../payments/payment-provider.registry.js';
import { paymentWebhookService } from '../payments/payment-webhook.service.js';

const password = 'StrongPassword123';
const adminEmail = 'operations.admin@veyora.test';
const customerEmail = 'operations.customer@veyora.test';
const otherEmail = 'operations.other@veyora.test';
const testEmails = [adminEmail, customerEmail, otherEmail];
const webhookEventId = 'evt_operations_retry_success';
const server = createServer(createApp());
const accessTokens = new Map<string, string>();
let baseUrl = '';
let shipmentOrderId = '';
let retryOrderId = '';
let reconciliationOrderId = '';
let retryAttemptId = '';
let reconciliationAttemptId = '';
let restoreEmailProvider = () => {};
let restorePaymentProvider = () => {};
let failNextEmail = true;
const sentEmails: SendEmailInput[] = [];

const testEmailProvider: EmailProvider = {
  configured: true,
  name: 'integration-test',
  send: (input) => {
    if (failNextEmail) {
      failNextEmail = false;
      return Promise.reject(new Error('Temporary SMTP test failure'));
    }
    sentEmails.push(input);
    return Promise.resolve({ messageId: `test-message-${sentEmails.length}` });
  },
};

const testPaymentProvider: PaymentProviderAdapter = {
  provider: PaymentProvider.SAFEPAY,
  createPaymentIntent: () => Promise.reject(new Error('Not used by this integration test')),
  verifyPayment: ({ providerPaymentId }) =>
    Promise.resolve({
      status:
        providerPaymentId === 'operations_reconcile_tracker'
          ? PaymentStatus.SUCCEEDED
          : PaymentStatus.PROCESSING,
    }),
  verifyWebhook: () => Promise.reject(new Error('Not used by this integration test')),
  refundPayment: () =>
    Promise.resolve({ providerRefundId: null, status: PaymentRefundStatus.PROCESSING }),
};

const cleanup = async () => {
  await prisma.shipmentEvent.deleteMany({
    where: { shipment: { order: { user: { email: { in: testEmails } } } } },
  });
  await prisma.shipment.deleteMany({
    where: { order: { user: { email: { in: testEmails } } } },
  });
  await cleanupOperationalRecords(testEmails);
  await prisma.paymentWebhookEvent.deleteMany({
    where: {
      OR: [
        { externalEventId: webhookEventId },
        { paymentAttempt: { order: { user: { email: { in: testEmails } } } } },
      ],
    },
  });
  await prisma.paymentRefund.deleteMany({
    where: { paymentAttempt: { order: { user: { email: { in: testEmails } } } } },
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

const headers = (email: string) => ({
  authorization: `Bearer ${accessTokens.get(email) ?? ''}`,
  'content-type': 'application/json',
});

const createOrder = (userId: string, email: string, orderNumber: string, status: OrderStatus) =>
  prisma.order.create({
    data: {
      checkoutFingerprint: orderNumber.padEnd(64, '0').slice(0, 64),
      currency: 'PKR',
      idempotencyKey: `key-${orderNumber}`,
      orderNumber,
      shippingAddress: {
        create: {
          address: '18 Operations Street',
          city: 'Lahore',
          country: 'Pakistan',
          email,
          fullName: 'Operations Customer',
          phone: '+92 300 1000000',
          postalCode: '54000',
          province: 'Punjab',
        },
      },
      status,
      subtotal: new Prisma.Decimal('7500.00'),
      total: new Prisma.Decimal('7500.00'),
      userId,
    },
  });

before(async () => {
  await cleanup();
  const passwordHash = await passwordService.hash(password);
  const [admin, customer, other] = await Promise.all([
    prisma.user.create({
      data: {
        email: adminEmail,
        firstName: 'Operations',
        lastName: 'Administrator',
        passwordHash,
        role: 'ADMIN',
      },
    }),
    prisma.user.create({
      data: {
        email: customerEmail,
        firstName: 'Operations',
        lastName: 'Customer',
        passwordHash,
      },
    }),
    prisma.user.create({
      data: {
        email: otherEmail,
        firstName: 'Other',
        lastName: 'Customer',
        passwordHash,
      },
    }),
  ]);

  const [shipmentOrder, retryOrder, reconciliationOrder] = await Promise.all([
    createOrder(customer.id, customer.email, 'AUR-OPERATIONS-SHIPMENT', OrderStatus.PROCESSING),
    createOrder(customer.id, customer.email, 'AUR-OPERATIONS-RETRY', OrderStatus.AWAITING_PAYMENT),
    createOrder(
      customer.id,
      customer.email,
      'AUR-OPERATIONS-RECONCILE',
      OrderStatus.AWAITING_PAYMENT,
    ),
  ]);
  shipmentOrderId = shipmentOrder.id;
  retryOrderId = retryOrder.id;
  reconciliationOrderId = reconciliationOrder.id;

  const retryAttempt = await prisma.paymentAttempt.create({
    data: {
      amount: new Prisma.Decimal('7500.00'),
      currency: 'PKR',
      orderId: retryOrderId,
      provider: PaymentProvider.SAFEPAY,
      providerPaymentId: 'operations_retry_tracker',
      status: PaymentStatus.PENDING,
    },
  });
  retryAttemptId = retryAttempt.id;
  const reconciliationAttempt = await prisma.paymentAttempt.create({
    data: {
      amount: new Prisma.Decimal('7500.00'),
      currency: 'PKR',
      orderId: reconciliationOrderId,
      provider: PaymentProvider.SAFEPAY,
      providerPaymentId: 'operations_reconcile_tracker',
      status: PaymentStatus.PENDING,
      updatedAt: new Date(Date.now() - 60 * 60_000),
    },
  });
  reconciliationAttemptId = reconciliationAttempt.id;
  await prisma.paymentWebhookEvent.create({
    data: {
      eventType: 'payment.succeeded',
      externalEventId: webhookEventId,
      lastError: 'Simulated transient processing failure',
      paymentAttemptId: retryAttemptId,
      payload: {
        data: { tracker: { token: 'operations_retry_tracker' } },
        id: webhookEventId,
        type: 'payment.succeeded',
      },
      processingStatus: PaymentWebhookProcessingStatus.FAILED,
      provider: PaymentProvider.SAFEPAY,
    },
  });

  restoreEmailProvider = replaceEmailProvider(testEmailProvider);
  restorePaymentProvider = replacePaymentProvider(testPaymentProvider);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  baseUrl = `http://127.0.0.1:${address.port}/api/v1`;
  await Promise.all([login(admin.email), login(customer.email), login(other.email)]);
});

after(async () => {
  restoreEmailProvider();
  restorePaymentProvider();
  await cleanup();
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
  await prisma.$disconnect();
});

void test('shipment lifecycle enforces authorization, ownership, transitions, and order state', async () => {
  const unauthenticated = await fetch(`${baseUrl}/admin/shipments`);
  assert.equal(unauthenticated.status, 401);
  const customerAdminAccess = await fetch(`${baseUrl}/admin/shipments`, {
    headers: headers(customerEmail),
  });
  assert.equal(customerAdminAccess.status, 403);

  const created = await fetch(`${baseUrl}/admin/orders/${shipmentOrderId}/shipments`, {
    body: JSON.stringify({ courier: 'TCS' }),
    headers: headers(adminEmail),
    method: 'POST',
  });
  assert.equal(created.status, 201);
  const createdPayload = (await created.json()) as ApiSuccess<ShipmentData>;
  const shipmentId = createdPayload.data.shipment.id;
  assert.equal(createdPayload.data.shipment.status, ShipmentStatus.PACKING);

  const duplicate = await fetch(`${baseUrl}/admin/orders/${shipmentOrderId}/shipments`, {
    body: JSON.stringify({ courier: 'TCS' }),
    headers: headers(adminEmail),
    method: 'POST',
  });
  assert.equal(duplicate.status, 409);

  const bypassShipment = await fetch(`${baseUrl}/admin/orders/${shipmentOrderId}/status`, {
    body: JSON.stringify({ status: OrderStatus.SHIPPED }),
    headers: headers(adminEmail),
    method: 'PATCH',
  });
  assert.equal(bypassShipment.status, 409);

  const otherTracking = await fetch(`${baseUrl}/orders/${shipmentOrderId}/shipments`, {
    headers: headers(otherEmail),
  });
  assert.equal(otherTracking.status, 404);

  const updateTracking = await fetch(`${baseUrl}/admin/shipments/${shipmentId}`, {
    body: JSON.stringify({ courier: 'TCS Express', trackingNumber: 'TCS-OPS-1001' }),
    headers: headers(adminEmail),
    method: 'PATCH',
  });
  assert.equal(updateTracking.status, 200);

  const invalidTransition = await fetch(`${baseUrl}/admin/shipments/${shipmentId}/events`, {
    body: JSON.stringify({ status: ShipmentStatus.SHIPPED }),
    headers: headers(adminEmail),
    method: 'POST',
  });
  assert.equal(invalidTransition.status, 409);

  for (const [status, location] of [
    [ShipmentStatus.READY_TO_SHIP, 'Lahore warehouse'],
    [ShipmentStatus.SHIPPED, 'Lahore dispatch center'],
    [ShipmentStatus.OUT_FOR_DELIVERY, 'Lahore delivery hub'],
    [ShipmentStatus.DELIVERED, 'Customer address'],
  ] as const) {
    const response = await fetch(`${baseUrl}/admin/shipments/${shipmentId}/events`, {
      body: JSON.stringify({ location, message: `${status} integration update`, status }),
      headers: headers(adminEmail),
      method: 'POST',
    });
    assert.equal(response.status, 201);
  }

  const trackingResponse = await fetch(`${baseUrl}/orders/${shipmentOrderId}/shipments`, {
    headers: headers(customerEmail),
  });
  assert.equal(trackingResponse.status, 200);
  const tracking = (await trackingResponse.json()) as ApiSuccess<ShipmentTrackingData>;
  assert.equal(tracking.data.shipment?.status, ShipmentStatus.DELIVERED);
  assert.equal(tracking.data.shipment?.events.length, 5);
  assert.equal(tracking.data.notifications.length, 2);

  const order = await prisma.order.findUniqueOrThrow({ where: { id: shipmentOrderId } });
  assert.equal(order.status, OrderStatus.DELIVERED);
  const auditResponse = await fetch(
    `${baseUrl}/admin/audit?entityType=SHIPMENT&page=1&pageSize=20`,
    {
      headers: headers(adminEmail),
    },
  );
  assert.equal(auditResponse.status, 200);
  const audit = (await auditResponse.json()) as ApiSuccess<AdminAuditListData>;
  assert.ok(audit.data.items.length >= 6);
  assert.ok(audit.data.items.every((entry) => entry.requestId));
});

void test('email queue retries transient failures and preserves delivery records', async () => {
  const firstRun = await emailQueueService.processBatch(2, { orderId: shipmentOrderId });
  assert.equal(firstRun, 2);
  const afterFailure = await prisma.emailQueueItem.findMany({
    where: { orderId: shipmentOrderId },
  });
  assert.equal(afterFailure.filter((item) => item.status === 'FAILED').length, 1);
  assert.equal(afterFailure.filter((item) => item.status === 'SENT').length, 1);

  await prisma.emailQueueItem.updateMany({
    data: { availableAt: new Date(Date.now() - 1_000) },
    where: { orderId: shipmentOrderId, status: 'FAILED' },
  });
  const retryRun = await emailQueueService.processBatch(2, { orderId: shipmentOrderId });
  assert.equal(retryRun, 1);
  const delivered = await prisma.emailQueueItem.findMany({ where: { orderId: shipmentOrderId } });
  assert.ok(delivered.every((item) => item.status === 'SENT'));
  assert.equal(
    delivered.reduce((total, item) => total + item.attempts, 0),
    3,
  );
  assert.equal(sentEmails.length, 2);
});

void test('background webhook retry and payment reconciliation recover safely', async () => {
  const retried = await paymentWebhookService.retryFailed(1, {
    paymentAttemptId: retryAttemptId,
  });
  assert.equal(retried, 1);
  const retryAttempt = await prisma.paymentAttempt.findUniqueOrThrow({
    where: { id: retryAttemptId },
  });
  assert.equal(retryAttempt.status, PaymentStatus.SUCCEEDED);
  const retryOrder = await prisma.order.findUniqueOrThrow({ where: { id: retryOrderId } });
  assert.equal(retryOrder.status, OrderStatus.PROCESSING);
  const webhook = await prisma.paymentWebhookEvent.findUniqueOrThrow({
    where: {
      provider_externalEventId: {
        externalEventId: webhookEventId,
        provider: PaymentProvider.SAFEPAY,
      },
    },
  });
  assert.equal(webhook.processingStatus, PaymentWebhookProcessingStatus.PROCESSED);

  const reconciled = await backgroundJobsService.reconcilePayments(1, {
    paymentAttemptId: reconciliationAttemptId,
  });
  assert.equal(reconciled, 1);
  const reconciliationAttempt = await prisma.paymentAttempt.findUniqueOrThrow({
    where: { id: reconciliationAttemptId },
  });
  assert.equal(reconciliationAttempt.status, PaymentStatus.SUCCEEDED);
  const reconciliationOrder = await prisma.order.findUniqueOrThrow({
    where: { id: reconciliationOrderId },
  });
  assert.equal(reconciliationOrder.status, OrderStatus.PROCESSING);
});

void test('cleanup, health, metrics, request IDs, and error IDs are operational', async () => {
  const customer = await prisma.user.findUniqueOrThrow({ where: { email: customerEmail } });
  const expired = await prisma.authSession.create({
    data: {
      expiresAt: new Date(Date.now() - 45 * 24 * 60 * 60_000),
      refreshTokenHash: 'f'.repeat(64),
      userId: customer.id,
    },
  });
  const removed = await backgroundJobsService.cleanupExpiredSessions();
  assert.ok(removed >= 1);
  assert.equal(await prisma.authSession.findUnique({ where: { id: expired.id } }), null);

  const operationalHeaders = env.METRICS_TOKEN
    ? { authorization: `Bearer ${env.METRICS_TOKEN}` }
    : undefined;
  const ready = await fetch(`${baseUrl.replace('/api/v1', '')}/health/ready`);
  assert.equal(ready.status, 200);
  assert.ok(ready.headers.get('x-request-id'));
  const operational = await fetch(`${baseUrl.replace('/api/v1', '')}/health/operational`, {
    ...(operationalHeaders ? { headers: operationalHeaders } : {}),
  });
  assert.equal(operational.status, 200);
  const metrics = await fetch(`${baseUrl.replace('/api/v1', '')}/metrics`, {
    ...(operationalHeaders ? { headers: operationalHeaders } : {}),
  });
  assert.equal(metrics.status, 200);
  assert.match(await metrics.text(), /veyora_http_requests_total/);

  const missing = await fetch(`${baseUrl}/definitely-not-a-route`);
  assert.equal(missing.status, 404);
  const missingPayload = (await missing.json()) as { error: { errorId?: string } };
  assert.ok(missingPayload.error.errorId);
});
