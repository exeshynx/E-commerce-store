import { Prisma } from '@prisma/client';
import { passwordService } from '../../apps/api/src/core/auth/password.service.js';
import { prisma } from '../../apps/api/src/infrastructure/database/prisma.js';
import { e2eData } from './test-data.js';

const testEmails = [e2eData.admin.email, e2eData.customer.email];
const userFilter = { email: { in: testEmails } };

export const cleanEndToEndData = async () => {
  await prisma.ticketAttachment.deleteMany({
    where: { message: { ticket: { user: userFilter } } },
  });
  await prisma.supportMessage.deleteMany({ where: { ticket: { user: userFilter } } });
  await prisma.returnShipmentEvent.deleteMany({
    where: { returnShipment: { returnRequest: { user: userFilter } } },
  });
  await prisma.emailQueueItem.deleteMany({
    where: {
      OR: [
        { recipientEmail: { in: testEmails } },
        { order: { user: userFilter } },
        { returnRequest: { user: userFilter } },
        { supportTicket: { user: userFilter } },
      ],
    },
  });
  await prisma.returnShipment.deleteMany({ where: { returnRequest: { user: userFilter } } });
  await prisma.paymentRefund.deleteMany({
    where: {
      OR: [
        { paymentAttempt: { order: { user: userFilter } } },
        { returnRequest: { user: userFilter } },
      ],
    },
  });
  await prisma.returnItem.deleteMany({ where: { returnRequest: { user: userFilter } } });
  await prisma.returnRequest.deleteMany({ where: { user: userFilter } });
  await prisma.supportTicket.deleteMany({ where: { user: userFilter } });
  await prisma.shipmentEvent.deleteMany({ where: { shipment: { order: { user: userFilter } } } });
  await prisma.shipment.deleteMany({ where: { order: { user: userFilter } } });
  await prisma.paymentWebhookEvent.deleteMany({
    where: { paymentAttempt: { order: { user: userFilter } } },
  });
  await prisma.paymentAttempt.deleteMany({ where: { order: { user: userFilter } } });
  await prisma.review.deleteMany({
    where: {
      OR: [{ user: userFilter }, { moderatedBy: userFilter }],
    },
  });
  await prisma.productView.deleteMany({ where: { user: userFilter } });
  await prisma.couponUsage.deleteMany({ where: { user: userFilter } });
  await prisma.orderStatusHistory.deleteMany({ where: { order: { user: userFilter } } });
  await prisma.shippingAddressSnapshot.deleteMany({ where: { order: { user: userFilter } } });
  await prisma.orderItem.deleteMany({ where: { order: { user: userFilter } } });
  await prisma.order.deleteMany({ where: { user: userFilter } });
  await prisma.address.deleteMany({ where: { user: userFilter } });
  await prisma.cartItem.deleteMany({ where: { cart: { user: userFilter } } });
  await prisma.cart.deleteMany({ where: { user: userFilter } });
  await prisma.wishlistItem.deleteMany({ where: { wishlist: { user: userFilter } } });
  await prisma.wishlist.deleteMany({ where: { user: userFilter } });
  await prisma.adminAuditLog.deleteMany({ where: { administrator: userFilter } });
  await prisma.authSession.deleteMany({ where: { user: userFilter } });
  await prisma.user.deleteMany({ where: userFilter });
  await prisma.coupon.deleteMany({ where: { code: e2eData.couponCode } });
};

export const prepareEndToEndData = async () => {
  await cleanEndToEndData();
  await prisma.user.create({
    data: {
      email: e2eData.admin.email,
      firstName: e2eData.admin.firstName,
      lastName: e2eData.admin.lastName,
      passwordHash: await passwordService.hash(e2eData.admin.password),
      role: 'ADMIN',
    },
  });
  await prisma.coupon.create({
    data: {
      code: e2eData.couponCode,
      currency: 'PKR',
      description: 'Deterministic Playwright checkout coupon',
      isEnabled: true,
      maximumUses: 100,
      maximumUsesPerCustomer: 1,
      type: 'PERCENTAGE',
      value: new Prisma.Decimal(10),
    },
  });
};

export const disconnectEndToEndDatabase = () => prisma.$disconnect();
