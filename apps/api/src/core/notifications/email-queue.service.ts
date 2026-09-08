import { EmailNotificationType, EmailQueueStatus } from '@prisma/client';
import type { Prisma } from '@prisma/client';
import { prisma } from '../../infrastructure/database/prisma.js';
import { getEmailProvider } from './email-provider.registry.js';

type EmailDatabase = Prisma.TransactionClient | typeof prisma;
type EmailPayload = Record<string, string>;

const jsonPayload = (payload: EmailPayload): Prisma.InputJsonValue => payload;

export const enqueueEmail = (
  database: EmailDatabase,
  input: {
    deduplicationKey: string;
    notificationType: EmailNotificationType;
    orderId?: string;
    payload: EmailPayload;
    recipientEmail: string;
    returnRequestId?: string;
    subject: string;
    supportTicketId?: string;
    campaignId?: string;
  },
) =>
  database.emailQueueItem.createMany({
    data: [
      {
        deduplicationKey: input.deduplicationKey,
        ...(input.campaignId ? { campaignId: input.campaignId } : {}),
        notificationType: input.notificationType,
        ...(input.orderId ? { orderId: input.orderId } : {}),
        payload: jsonPayload(input.payload),
        recipientEmail: input.recipientEmail,
        ...(input.returnRequestId ? { returnRequestId: input.returnRequestId } : {}),
        subject: input.subject,
        ...(input.supportTicketId ? { supportTicketId: input.supportTicketId } : {}),
      },
    ],
    skipDuplicates: true,
  });

export const enqueuePaymentSuccessEmail = async (
  database: EmailDatabase,
  paymentId: string,
  orderId: string,
) => {
  const order = await database.order.findUnique({
    select: {
      orderNumber: true,
      shippingAddress: { select: { email: true, fullName: true } },
      user: { select: { email: true, firstName: true, lastName: true } },
    },
    where: { id: orderId },
  });
  if (!order) return;
  await enqueueEmail(database, {
    deduplicationKey: `payment:${paymentId}:success`,
    notificationType: EmailNotificationType.PAYMENT_SUCCESS,
    orderId,
    payload: {
      customerName:
        order.shippingAddress?.fullName ?? `${order.user.firstName} ${order.user.lastName}`,
      orderNumber: order.orderNumber,
    },
    recipientEmail: order.shippingAddress?.email ?? order.user.email,
    subject: `Payment confirmed for ${order.orderNumber}`,
  });
};

const payloadObject = (value: Prisma.JsonValue): EmailPayload => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string',
    ),
  );
};

const escapeHtml = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

const renderEmail = (notificationType: EmailNotificationType, payloadValue: Prisma.JsonValue) => {
  const payload = payloadObject(payloadValue);
  const orderNumber = payload.orderNumber ?? 'your order';
  const lines: string[] = [];
  if (notificationType === EmailNotificationType.ORDER_CONFIRMATION) {
    lines.push(
      `We received ${orderNumber}.`,
      `Order total: ${payload.total ?? ''} ${payload.currency ?? ''}.`,
    );
  } else if (notificationType === EmailNotificationType.PAYMENT_SUCCESS) {
    lines.push(`Payment for ${orderNumber} was confirmed successfully.`);
  } else if (notificationType === EmailNotificationType.SHIPMENT_NOTIFICATION) {
    lines.push(
      `${orderNumber} has shipped with ${payload.courier ?? 'the courier'}.`,
      `Tracking number: ${payload.trackingNumber ?? 'Pending'}.`,
    );
  } else if (notificationType === EmailNotificationType.DELIVERY_CONFIRMATION) {
    lines.push(`${orderNumber} was delivered successfully.`);
  } else if (notificationType === EmailNotificationType.RETURN_REQUESTED) {
    lines.push(`Return ${payload.returnNumber ?? ''} was received and is awaiting review.`);
  } else if (notificationType === EmailNotificationType.RETURN_APPROVED) {
    lines.push(
      `Return ${payload.returnNumber ?? ''} was approved.`,
      'You may now send the items back.',
    );
  } else if (notificationType === EmailNotificationType.RETURN_REJECTED) {
    lines.push(`Return ${payload.returnNumber ?? ''} was not approved.`, payload.reason ?? '');
  } else if (notificationType === EmailNotificationType.REFUND_COMPLETED) {
    lines.push(
      `Refund processing for return ${payload.returnNumber ?? ''} is complete.`,
      `Refunded: ${payload.amount ?? ''} ${payload.currency ?? ''}.`,
    );
  } else if (notificationType === EmailNotificationType.SUPPORT_TICKET_CREATED) {
    lines.push(`Support ticket ${payload.ticketNumber ?? ''} was created.`, payload.subject ?? '');
  } else if (notificationType === EmailNotificationType.SUPPORT_ADMIN_REPLY) {
    lines.push(`Our support team replied to ticket ${payload.ticketNumber ?? ''}.`);
  } else if (notificationType === EmailNotificationType.CAMPAIGN_MESSAGE) {
    lines.push(payload.campaignMessage ?? 'A new Veyora campaign is available.');
  } else {
    lines.push(`Support ticket ${payload.ticketNumber ?? ''} was resolved.`);
  }
  const text = [`Hello ${payload.customerName ?? 'customer'},`, '', ...lines, '', 'Veyora'].join(
    '\n',
  );
  const html = `<p>Hello ${escapeHtml(payload.customerName ?? 'customer')},</p>${lines
    .map((line) => `<p>${escapeHtml(line)}</p>`)
    .join('')}<p>Veyora</p>`;
  return { html, text };
};

const claimNextEmail = async (orderId?: string) => {
  const staleBefore = new Date(Date.now() - 10 * 60_000);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const candidate = await prisma.emailQueueItem.findFirst({
      orderBy: [{ availableAt: 'asc' }, { createdAt: 'asc' }],
      where: {
        attempts: { lt: 5 },
        availableAt: { lte: new Date() },
        ...(orderId ? { orderId } : {}),
        OR: [
          { status: { in: [EmailQueueStatus.PENDING, EmailQueueStatus.FAILED] } },
          { lockedAt: { lt: staleBefore }, status: EmailQueueStatus.PROCESSING },
        ],
      },
    });
    if (!candidate) return null;
    const claimed = await prisma.emailQueueItem.updateMany({
      data: {
        attempts: { increment: 1 },
        lastError: null,
        lockedAt: new Date(),
        status: EmailQueueStatus.PROCESSING,
      },
      where: {
        id: candidate.id,
        OR: [
          { status: { in: [EmailQueueStatus.PENDING, EmailQueueStatus.FAILED] } },
          { lockedAt: { lt: staleBefore }, status: EmailQueueStatus.PROCESSING },
        ],
      },
    });
    if (claimed.count === 1)
      return prisma.emailQueueItem.findUniqueOrThrow({ where: { id: candidate.id } });
  }
  return null;
};

export const emailQueueService = {
  enqueue: enqueueEmail,
  processBatch: async (limit: number, options?: { orderId?: string }) => {
    const provider = getEmailProvider();
    if (!provider.configured) return 0;
    let processed = 0;
    while (processed < limit) {
      const item = await claimNextEmail(options?.orderId);
      if (!item) break;
      try {
        const rendered = renderEmail(item.notificationType, item.payload);
        const result = await provider.send({
          ...rendered,
          subject: item.subject,
          to: item.recipientEmail,
        });
        await prisma.emailQueueItem.update({
          data: {
            lastError: null,
            lockedAt: null,
            providerMessageId: result.messageId,
            sentAt: new Date(),
            status: EmailQueueStatus.SENT,
          },
          where: { id: item.id },
        });
      } catch (error) {
        const exhausted = item.attempts >= item.maxAttempts;
        await prisma.emailQueueItem.update({
          data: {
            availableAt: new Date(Date.now() + Math.min(60, 2 ** item.attempts) * 60_000),
            lastError: (error instanceof Error ? error.message : String(error)).slice(0, 1000),
            lockedAt: null,
            status: exhausted ? EmailQueueStatus.DEAD_LETTER : EmailQueueStatus.FAILED,
          },
          where: { id: item.id },
        });
      }
      processed += 1;
    }
    return processed;
  },
};
