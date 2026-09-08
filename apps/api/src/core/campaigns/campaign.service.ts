import {
  AdminAuditAction,
  AdminAuditEntityType,
  CampaignAudience,
  EmailNotificationType,
  PaymentStatus,
} from '@prisma/client';
import type { Prisma } from '@prisma/client';
import { prisma } from '../../infrastructure/database/prisma.js';
import { AppError } from '../../http/errors/app-error.js';
import { recordAdminAudit, type AdminAuditContext } from '../audit/audit.service.js';
import type { CampaignCreateInput } from './campaign.schemas.js';

const serializeCampaign = (campaign: {
  _count: { emailQueueItems: number; recipients: number };
  audience: CampaignAudience;
  createdAt: Date;
  id: string;
  message: string;
  name: string;
  queuedAt: Date | null;
  status: 'DRAFT' | 'QUEUED';
  subject: string;
}) => ({
  ...campaign,
  createdAt: campaign.createdAt.toISOString(),
  queuedAt: campaign.queuedAt?.toISOString() ?? null,
  queuedMessages: campaign._count.emailQueueItems,
  recipientCount: campaign._count.recipients,
  _count: undefined,
});

const campaignInclude = {
  _count: { select: { emailQueueItems: true, recipients: true } },
} satisfies Prisma.CampaignInclude;

const audienceWhere = (audience: CampaignAudience): Prisma.UserWhereInput => ({
  isGuest: false,
  role: 'CUSTOMER',
  status: 'ACTIVE',
  ...(audience === CampaignAudience.CUSTOMERS_WITH_CARTS
    ? { cart: { items: { some: {} } } }
    : audience === CampaignAudience.PURCHASERS
      ? { orders: { some: { paymentAttempts: { some: { status: PaymentStatus.SUCCEEDED } } } } }
      : {}),
});

export const campaignService = {
  create: async (input: CampaignCreateInput, audit: AdminAuditContext) =>
    prisma.$transaction(async (transaction) => {
      const campaign = await transaction.campaign.create({
        data: { ...input, createdById: audit.administratorId },
        include: campaignInclude,
      });
      await recordAdminAudit(transaction, audit, {
        action: AdminAuditAction.CAMPAIGN_CREATED,
        entityId: campaign.id,
        entityType: AdminAuditEntityType.CAMPAIGN,
        metadata: { audience: campaign.audience, name: campaign.name },
      });
      return serializeCampaign(campaign);
    }),

  list: async () => {
    const campaigns = await prisma.campaign.findMany({
      include: campaignInclude,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 100,
    });
    return { items: campaigns.map(serializeCampaign) };
  },

  queue: async (id: string, audit: AdminAuditContext) =>
    prisma.$transaction(async (transaction) => {
      const campaign = await transaction.campaign.findUnique({ where: { id } });
      if (!campaign) throw new AppError(404, 'CAMPAIGN_NOT_FOUND', 'Campaign not found.');
      if (campaign.status === 'QUEUED') {
        const existing = await transaction.campaign.findUniqueOrThrow({
          include: campaignInclude,
          where: { id },
        });
        return serializeCampaign(existing);
      }
      const users = await transaction.user.findMany({
        select: { email: true, firstName: true, id: true },
        where: audienceWhere(campaign.audience),
      });
      if (users.length === 0) {
        throw new AppError(
          409,
          'CAMPAIGN_AUDIENCE_EMPTY',
          'No registered users match this audience.',
        );
      }
      await transaction.campaignRecipient.createMany({
        data: users.map((user) => ({ campaignId: id, email: user.email, userId: user.id })),
        skipDuplicates: true,
      });
      await transaction.emailQueueItem.createMany({
        data: users.map((user) => ({
          campaignId: id,
          deduplicationKey: `campaign:${id}:user:${user.id}`,
          notificationType: EmailNotificationType.CAMPAIGN_MESSAGE,
          payload: { campaignMessage: campaign.message, customerName: user.firstName },
          recipientEmail: user.email,
          subject: campaign.subject,
        })),
        skipDuplicates: true,
      });
      const updated = await transaction.campaign.update({
        data: { queuedAt: new Date(), status: 'QUEUED' },
        include: campaignInclude,
        where: { id },
      });
      await recordAdminAudit(transaction, audit, {
        action: AdminAuditAction.CAMPAIGN_QUEUED,
        entityId: id,
        entityType: AdminAuditEntityType.CAMPAIGN,
        metadata: { audience: campaign.audience, recipientCount: users.length },
      });
      return serializeCampaign(updated);
    }),
};
