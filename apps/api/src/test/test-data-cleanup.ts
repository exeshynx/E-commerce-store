import { prisma } from '../infrastructure/database/prisma.js';

export const cleanupOperationalRecords = async (emails: string[]) => {
  await prisma.emailQueueItem.deleteMany({
    where: {
      OR: [
        { recipientEmail: { in: emails } },
        { order: { user: { email: { in: emails } } } },
        { returnRequest: { user: { email: { in: emails } } } },
        { supportTicket: { user: { email: { in: emails } } } },
      ],
    },
  });
  await prisma.adminAuditLog.deleteMany({
    where: { administrator: { email: { in: emails } } },
  });
};

export const cleanupAfterSalesRecords = async (emails: string[]) => {
  await prisma.ticketAttachment.deleteMany({
    where: { message: { ticket: { user: { email: { in: emails } } } } },
  });
  await prisma.supportMessage.deleteMany({
    where: { ticket: { user: { email: { in: emails } } } },
  });
  await prisma.returnShipmentEvent.deleteMany({
    where: { returnShipment: { returnRequest: { user: { email: { in: emails } } } } },
  });
  await cleanupOperationalRecords(emails);
  await prisma.returnShipment.deleteMany({
    where: { returnRequest: { user: { email: { in: emails } } } },
  });
  await prisma.paymentRefund.deleteMany({
    where: { returnRequest: { user: { email: { in: emails } } } },
  });
  await prisma.returnItem.deleteMany({
    where: { returnRequest: { user: { email: { in: emails } } } },
  });
  await prisma.returnRequest.deleteMany({ where: { user: { email: { in: emails } } } });
  await prisma.supportTicket.deleteMany({ where: { user: { email: { in: emails } } } });
};
