import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { createServer } from 'node:http';
import { after, before, test } from 'node:test';
import type {
  AdminPaymentDetailData,
  AdminPaymentListData,
  ApiSuccess,
  AuthSessionData,
  OrderPaymentHistoryData,
  PaymentAttemptData,
  PaymentRefundData,
} from '@aurelia/contracts';
import { Prisma } from '@prisma/client';
import { createApp } from '../../app.js';
import { prisma } from '../../infrastructure/database/prisma.js';
import { cleanupOperationalRecords } from '../../test/test-data-cleanup.js';
import { passwordService } from '../auth/password.service.js';
import { replacePaymentProvider } from './payment-provider.registry.js';
import type { SafepayGatewayClient } from './safepay.client.js';
import { createSafepayPaymentProvider } from './safepay-payment.provider.js';

const password = 'StrongPassword123';
const webhookSecret = 'phase-7-webhook-secret-that-is-long-enough';
const adminEmail = 'gateway.admin@aurelia.test';
const customerEmail = 'gateway.customer@aurelia.test';
const otherCustomerEmail = 'gateway.other@aurelia.test';
const testEmails = [adminEmail, customerEmail, otherCustomerEmail];
const eventIds = [
  'evt_gateway-payment-failed',
  'evt_gateway-payment-succeeded',
  'evt_gateway-payment-refunded',
] as const;
const server = createServer(createApp());
const accessTokens = new Map<string, string>();
let baseUrl = '';
let customerOrderId = '';
let credentialFailureOrderId = '';
let otherCustomerOrderId = '';
let restoreProvider = () => {};
let failAuthentication = false;
let trackerSequence = 0;
let refundSequence = 0;

const fakeClient: SafepayGatewayClient = {
  createCheckoutUrl: ({ tracker }) => `https://sandbox.example.test/checkout?tracker=${tracker}`,
  createPassportToken: () => Promise.resolve({ data: 'passport_test_token' }),
  createTracker: () => {
    if (failAuthentication) {
      return Promise.reject(Object.assign(new Error('Invalid credentials'), { status: 401 }));
    }
    trackerSequence += 1;
    return Promise.resolve({ data: { tracker: { token: `track_gateway_${trackerSequence}` } } });
  },
  fetchPayment: () => Promise.resolve({ data: { tracker: { state: 'TRACKER_STARTED' } } }),
  refundPayment: () => {
    refundSequence += 1;
    return Promise.resolve({
      data: { refund: { token: `refund_gateway_${refundSequence}` } },
      ok: true,
    });
  },
};

const cleanup = async () => {
  await cleanupOperationalRecords(testEmails);
  await prisma.paymentWebhookEvent.deleteMany({
    where: {
      OR: [
        { externalEventId: { in: [...eventIds] } },
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

const headers = (email: string, idempotencyKey?: string) => ({
  authorization: `Bearer ${accessTokens.get(email) ?? ''}`,
  'content-type': 'application/json',
  ...(idempotencyKey ? { 'idempotency-key': idempotencyKey } : {}),
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

const createOrder = (
  userId: string,
  suffix: string,
  status: 'AWAITING_PAYMENT' | 'PENDING' = 'AWAITING_PAYMENT',
) =>
  prisma.order.create({
    data: {
      checkoutFingerprint: suffix.padEnd(64, '7').slice(0, 64),
      currency: 'PKR',
      idempotencyKey: `gateway-order-${suffix}`,
      orderNumber: `AUR-GATEWAY-${suffix}`,
      shippingAddress: {
        create: {
          address: 'House 7, Test Street',
          city: 'Lahore',
          country: 'Pakistan',
          email: `${suffix.toLowerCase()}@aurelia.test`,
          fullName: 'Gateway Customer',
          phone: '+92 300 1234567',
          postalCode: '54000',
          province: 'Punjab',
        },
      },
      status,
      subtotal: new Prisma.Decimal('12500.00'),
      total: new Prisma.Decimal('12500.00'),
      userId,
    },
  });

const errorCode = async (response: Response) =>
  ((await response.json()) as { error: { code: string } }).error.code;

const sendWebhook = (payload: object, validSignature = true) => {
  const rawBody = JSON.stringify(payload);
  const signature = createHmac('sha512', validSignature ? webhookSecret : 'wrong-secret')
    .update(rawBody)
    .digest('hex');
  return fetch(`${baseUrl}/payments/webhooks/safepay`, {
    body: rawBody,
    headers: { 'content-type': 'application/json', 'x-sfpy-signature': signature },
    method: 'POST',
  });
};

before(async () => {
  await cleanup();
  restoreProvider = replacePaymentProvider(
    createSafepayPaymentProvider({
      client: fakeClient,
      enabled: true,
      environment: 'sandbox',
      publicKey: 'sec_test_public_key',
      secretKey: 'sec_test_secret_key',
      webhookSecret,
    }),
  );
  const passwordHash = await passwordService.hash(password);
  const [, customer, otherCustomer] = await Promise.all([
    prisma.user.create({
      data: {
        email: adminEmail,
        firstName: 'Gateway',
        lastName: 'Administrator',
        passwordHash,
        role: 'ADMIN',
      },
    }),
    prisma.user.create({
      data: { email: customerEmail, firstName: 'Gateway', lastName: 'Customer', passwordHash },
    }),
    prisma.user.create({
      data: { email: otherCustomerEmail, firstName: 'Other', lastName: 'Customer', passwordHash },
    }),
  ]);
  const [customerOrder, credentialOrder, otherOrder] = await Promise.all([
    createOrder(customer.id, 'CUSTOMER', 'PENDING'),
    createOrder(customer.id, 'CREDENTIALS'),
    createOrder(otherCustomer.id, 'OTHER'),
  ]);
  customerOrderId = customerOrder.id;
  credentialFailureOrderId = credentialOrder.id;
  otherCustomerOrderId = otherOrder.id;

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  baseUrl = `http://127.0.0.1:${address.port}/api/v1`;
  await Promise.all(testEmails.map(login));
});

after(async () => {
  restoreProvider();
  await cleanup();
  server.closeAllConnections();
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
  await prisma.$disconnect();
});

void test('Safepay creation, signed webhooks, retry, ownership, admin history, and refunds', async () => {
  const unauthenticated = await fetch(`${baseUrl}/orders/${customerOrderId}/payments/safepay`, {
    method: 'POST',
  });
  assert.equal(unauthenticated.status, 401);

  const otherOrder = await fetch(`${baseUrl}/orders/${otherCustomerOrderId}/payments/safepay`, {
    headers: headers(customerEmail, 'gateway-other-order-key-001'),
    method: 'POST',
  });
  assert.equal(otherOrder.status, 404);

  failAuthentication = true;
  const invalidCredentials = await fetch(
    `${baseUrl}/orders/${credentialFailureOrderId}/payments/safepay`,
    {
      headers: headers(customerEmail, 'gateway-invalid-credentials-001'),
      method: 'POST',
    },
  );
  failAuthentication = false;
  assert.equal(invalidCredentials.status, 502);
  assert.equal(await errorCode(invalidCredentials), 'PAYMENT_PROVIDER_AUTHENTICATION_FAILED');
  const failedCredentialAttempt = await prisma.paymentAttempt.findFirstOrThrow({
    where: { orderId: credentialFailureOrderId },
  });
  assert.equal(failedCredentialAttempt.status, 'FAILED');

  const firstKey = 'gateway-payment-attempt-key-001';
  const firstCreation = await fetch(`${baseUrl}/orders/${customerOrderId}/payments/safepay`, {
    headers: headers(customerEmail, firstKey),
    method: 'POST',
  });
  assert.equal(firstCreation.status, 201);
  const first = ((await firstCreation.json()) as ApiSuccess<PaymentAttemptData>).data;
  assert.equal(first.payment.provider, 'SAFEPAY');
  assert.equal(first.payment.status, 'PENDING');
  assert.equal(first.orderStatus, 'AWAITING_PAYMENT');
  assert.match(first.checkoutUrl ?? '', /^https:\/\/sandbox\.example\.test\/checkout/);

  const replay = await fetch(`${baseUrl}/orders/${customerOrderId}/payments/safepay`, {
    headers: headers(customerEmail, firstKey),
    method: 'POST',
  });
  assert.equal(replay.status, 201);
  const replayData = ((await replay.json()) as ApiSuccess<PaymentAttemptData>).data;
  assert.equal(replayData.payment.id, first.payment.id);
  assert.equal(replayData.checkoutUrl, first.checkoutUrl);

  const activeConflict = await fetch(`${baseUrl}/orders/${customerOrderId}/payments/safepay`, {
    headers: headers(customerEmail, 'gateway-payment-attempt-key-002'),
    method: 'POST',
  });
  assert.equal(activeConflict.status, 409);
  assert.equal(await errorCode(activeConflict), 'PAYMENT_ATTEMPT_ACTIVE');

  const failedPayload = {
    data: {
      message: 'Issuer declined the transaction.',
      tracker: first.payment.providerPaymentId,
    },
    token: eventIds[0],
    type: 'payment.failed',
  };
  const invalidSignature = await sendWebhook(failedPayload, false);
  assert.equal(invalidSignature.status, 401);
  assert.equal(await errorCode(invalidSignature), 'INVALID_WEBHOOK_SIGNATURE');
  assert.equal(
    await prisma.paymentWebhookEvent.count({ where: { externalEventId: eventIds[0] } }),
    0,
  );

  const failedWebhook = await sendWebhook(failedPayload);
  assert.equal(failedWebhook.status, 200);
  const failedAttempt = await prisma.paymentAttempt.findUniqueOrThrow({
    where: { id: first.payment.id },
  });
  assert.equal(failedAttempt.status, 'FAILED');
  assert.equal(
    (await prisma.order.findUniqueOrThrow({ where: { id: customerOrderId } })).status,
    'AWAITING_PAYMENT',
  );

  const retryCreation = await fetch(`${baseUrl}/orders/${customerOrderId}/payments/safepay`, {
    headers: headers(customerEmail, 'gateway-payment-retry-key-001'),
    method: 'POST',
  });
  assert.equal(retryCreation.status, 201);
  const retry = ((await retryCreation.json()) as ApiSuccess<PaymentAttemptData>).data;
  assert.notEqual(retry.payment.id, first.payment.id);

  const succeededPayload = {
    data: { tracker: retry.payment.providerPaymentId },
    token: eventIds[1],
    type: 'payment.succeeded',
  };
  const [successWebhook, duplicateWebhook] = await Promise.all([
    sendWebhook(succeededPayload),
    sendWebhook(succeededPayload),
  ]);
  assert.deepEqual([successWebhook.status, duplicateWebhook.status], [200, 200]);

  const [storedOrder, storedRetry, storedEvent, systemHistory] = await Promise.all([
    prisma.order.findUniqueOrThrow({ where: { id: customerOrderId } }),
    prisma.paymentAttempt.findUniqueOrThrow({ where: { id: retry.payment.id } }),
    prisma.paymentWebhookEvent.findUniqueOrThrow({
      where: {
        provider_externalEventId: { externalEventId: eventIds[1], provider: 'SAFEPAY' },
      },
    }),
    prisma.orderStatusHistory.findMany({ where: { orderId: customerOrderId } }),
  ]);
  assert.equal(storedOrder.status, 'PROCESSING');
  assert.equal(storedRetry.status, 'SUCCEEDED');
  assert.equal(storedEvent.processingStatus, 'PROCESSED');
  assert.equal(storedEvent.processingAttempts, 1);
  assert.equal(systemHistory.length, 2);
  assert.deepEqual(systemHistory.map((history) => history.systemActor).sort(), [
    'SAFEPAY_CHECKOUT',
    'SAFEPAY_WEBHOOK',
  ]);
  assert.ok(systemHistory.every((history) => history.actorType === 'SYSTEM'));

  const forbiddenHistory = await fetch(`${baseUrl}/orders/${customerOrderId}/payments`, {
    headers: headers(otherCustomerEmail),
  });
  assert.equal(forbiddenHistory.status, 404);
  const customerHistory = await fetch(`${baseUrl}/orders/${customerOrderId}/payments`, {
    headers: headers(customerEmail),
  });
  assert.equal(customerHistory.status, 200);
  const history = (await customerHistory.json()) as ApiSuccess<OrderPaymentHistoryData>;
  assert.equal(history.data.items.length, 2);

  const adminListResponse = await fetch(`${baseUrl}/admin/payments?provider=SAFEPAY`, {
    headers: headers(adminEmail),
  });
  assert.equal(adminListResponse.status, 200);
  const adminList = (await adminListResponse.json()) as ApiSuccess<AdminPaymentListData>;
  assert.ok(adminList.data.items.some((payment) => payment.id === retry.payment.id));

  const refundResponse = await fetch(`${baseUrl}/admin/payments/${retry.payment.id}/refunds`, {
    body: JSON.stringify({ amount: '2500.00', reason: 'Customer-requested partial refund' }),
    headers: headers(adminEmail, 'gateway-refund-key-0001'),
    method: 'POST',
  });
  assert.equal(refundResponse.status, 201);
  const refund = ((await refundResponse.json()) as ApiSuccess<PaymentRefundData>).data.refund;
  assert.equal(refund.status, 'SUCCEEDED');
  assert.equal(refund.amount, '2500.00');

  const refundReplay = await fetch(`${baseUrl}/admin/payments/${retry.payment.id}/refunds`, {
    body: JSON.stringify({ amount: '2500.00', reason: 'Customer-requested partial refund' }),
    headers: headers(adminEmail, 'gateway-refund-key-0001'),
    method: 'POST',
  });
  assert.equal(refundReplay.status, 201);
  const replayedRefund = ((await refundReplay.json()) as ApiSuccess<PaymentRefundData>).data.refund;
  assert.equal(replayedRefund.id, refund.id);

  const refundWebhook = await sendWebhook({
    created_at: { seconds: Math.floor(Date.now() / 1000) },
    data: {
      currency: 'PKR',
      refund_amount: 250_000,
      state: 'TRACKER_PARTIAL_REFUND',
      tracker: retry.payment.providerPaymentId,
    },
    token: eventIds[2],
    type: 'payment.refunded',
  });
  assert.equal(refundWebhook.status, 200);
  const storedRefundEvent = await prisma.paymentWebhookEvent.findUniqueOrThrow({
    where: {
      provider_externalEventId: { externalEventId: eventIds[2], provider: 'SAFEPAY' },
    },
  });
  assert.equal(storedRefundEvent.paymentAttemptId, retry.payment.id);
  assert.equal(storedRefundEvent.processingStatus, 'PROCESSED');
  assert.equal(
    await prisma.paymentRefund.count({ where: { paymentAttemptId: retry.payment.id } }),
    1,
  );
  assert.equal(
    (await prisma.paymentAttempt.findUniqueOrThrow({ where: { id: retry.payment.id } })).status,
    'SUCCEEDED',
  );

  const detailResponse = await fetch(`${baseUrl}/admin/payments/${retry.payment.id}`, {
    headers: headers(adminEmail),
  });
  assert.equal(detailResponse.status, 200);
  const detail = (await detailResponse.json()) as ApiSuccess<AdminPaymentDetailData>;
  assert.equal(detail.data.payment.refunds.length, 1);
  assert.equal(detail.data.webhookEvents.length, 2);
  assert.equal(detail.data.webhookEvents[0]?.signatureVerified, true);
});
