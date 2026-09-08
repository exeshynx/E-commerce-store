import { EmailNotificationType, PaymentRefundStatus, Prisma, ReturnStatus } from '@prisma/client';
import type { PrismaClient } from '@prisma/client';
import { enqueueEmail } from '../notifications/email-queue.service.js';

type Database = Prisma.TransactionClient | PrismaClient;

export const synchronizeReturnRefundStatus = async (
  database: Database,
  returnRequestId: string | null,
) => {
  if (!returnRequestId) return;
  const request = await database.returnRequest.findUnique({
    select: {
      items: { select: { currency: true, refundAmount: true } },
      orderId: true,
      refunds: {
        select: { amount: true },
        where: { status: PaymentRefundStatus.SUCCEEDED },
      },
      returnNumber: true,
      status: true,
      user: { select: { email: true, firstName: true, lastName: true } },
    },
    where: { id: returnRequestId },
  });
  if (!request || request.status !== ReturnStatus.REFUND_PENDING) return;

  const expected = request.items.reduce(
    (total, item) => total.plus(item.refundAmount),
    new Prisma.Decimal(0),
  );
  const succeeded = request.refunds.reduce(
    (total, refund) => total.plus(refund.amount),
    new Prisma.Decimal(0),
  );
  if (succeeded.lt(expected)) return;

  const changed = await database.returnRequest.updateMany({
    data: { refundedAt: new Date(), status: ReturnStatus.REFUNDED },
    where: { id: returnRequestId, status: ReturnStatus.REFUND_PENDING },
  });
  if (changed.count !== 1) return;

  await enqueueEmail(database, {
    deduplicationKey: `return:${returnRequestId}:refunded`,
    notificationType: EmailNotificationType.REFUND_COMPLETED,
    orderId: request.orderId,
    payload: {
      amount: succeeded.toFixed(2),
      currency: request.items[0]?.currency ?? 'PKR',
      customerName: `${request.user.firstName} ${request.user.lastName}`,
      returnNumber: request.returnNumber,
    },
    recipientEmail: request.user.email,
    returnRequestId,
    subject: `Refund completed for ${request.returnNumber}`,
  });
};
