import { randomUUID } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import {
  AdminAuditAction,
  AdminAuditEntityType,
  EmailNotificationType,
  SupportTicketStatus,
  UserRole,
} from '@prisma/client';
import { AppError } from '../../http/errors/app-error.js';
import { prisma } from '../../infrastructure/database/prisma.js';
import { recordAdminAudit, type AdminAuditContext } from '../audit/audit.service.js';
import { enqueueEmail } from '../notifications/email-queue.service.js';
import type {
  AdminSupportTicketListQuery,
  AdminSupportTicketUpdateInput,
  SupportMessageCreateInput,
  SupportTicketCreateInput,
  SupportTicketListQuery,
} from './support.schemas.js';

const ticketDetailInclude = {
  assignedTo: { select: { email: true, firstName: true, id: true, lastName: true } },
  messages: {
    include: {
      attachments: { orderBy: { createdAt: 'asc' as const } },
      author: { select: { email: true, firstName: true, id: true, lastName: true } },
    },
    orderBy: [{ createdAt: 'asc' as const }, { id: 'asc' as const }],
  },
  order: { select: { id: true, orderNumber: true, status: true } },
  user: { select: { email: true, firstName: true, id: true, lastName: true } },
} satisfies Prisma.SupportTicketInclude;

const ticketSummarySelect = {
  assignedTo: { select: { email: true, firstName: true, id: true, lastName: true } },
  createdAt: true,
  id: true,
  order: { select: { id: true, orderNumber: true } },
  priority: true,
  status: true,
  subject: true,
  ticketNumber: true,
  updatedAt: true,
  user: { select: { email: true, firstName: true, id: true, lastName: true } },
  _count: { select: { messages: true } },
} satisfies Prisma.SupportTicketSelect;

type TicketDetail = Prisma.SupportTicketGetPayload<{ include: typeof ticketDetailInclude }>;
type TicketSummary = Prisma.SupportTicketGetPayload<{ select: typeof ticketSummarySelect }>;

const serializeSummary = (ticket: TicketSummary, includeCustomer = true) => ({
  assignedTo: ticket.assignedTo,
  createdAt: ticket.createdAt.toISOString(),
  ...(includeCustomer ? { customer: ticket.user } : {}),
  id: ticket.id,
  messageCount: ticket._count.messages,
  order: ticket.order,
  priority: ticket.priority,
  status: ticket.status,
  subject: ticket.subject,
  ticketNumber: ticket.ticketNumber,
  updatedAt: ticket.updatedAt.toISOString(),
});

const serializeDetail = (ticket: TicketDetail, includeCustomer = true) => ({
  assignedTo: ticket.assignedTo,
  closedAt: ticket.closedAt?.toISOString() ?? null,
  createdAt: ticket.createdAt.toISOString(),
  ...(includeCustomer ? { customer: ticket.user } : {}),
  id: ticket.id,
  messages: ticket.messages.map((message) => ({
    attachments: message.attachments.map((attachment) => ({
      ...attachment,
      createdAt: attachment.createdAt.toISOString(),
    })),
    author: message.author,
    authorRole: message.authorRole,
    body: message.body,
    createdAt: message.createdAt.toISOString(),
    id: message.id,
  })),
  order: ticket.order,
  priority: ticket.priority,
  resolvedAt: ticket.resolvedAt?.toISOString() ?? null,
  status: ticket.status,
  subject: ticket.subject,
  ticketNumber: ticket.ticketNumber,
  updatedAt: ticket.updatedAt.toISOString(),
});

const getTicketOrThrow = async (id: string, userId?: string) => {
  const ticket = await prisma.supportTicket.findFirst({
    include: ticketDetailInclude,
    where: { id, ...(userId ? { userId } : {}) },
  });
  if (!ticket)
    throw new AppError(404, 'SUPPORT_TICKET_NOT_FOUND', 'The support ticket does not exist.');
  return ticket;
};

const createTicketNumber = () =>
  `SUP-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${randomUUID().replaceAll('-', '').slice(0, 10).toUpperCase()}`;

const attachmentCreate = (attachments: SupportMessageCreateInput['attachments']) =>
  attachments.map((attachment) => ({
    ...(attachment.checksum ? { checksum: attachment.checksum.toLowerCase() } : {}),
    fileName: attachment.fileName,
    mediaType: attachment.mediaType.toLowerCase(),
    sizeBytes: attachment.sizeBytes,
  }));

const statusTransitions: Record<SupportTicketStatus, SupportTicketStatus[]> = {
  OPEN: [
    SupportTicketStatus.IN_PROGRESS,
    SupportTicketStatus.WAITING_CUSTOMER,
    SupportTicketStatus.RESOLVED,
    SupportTicketStatus.CLOSED,
  ],
  IN_PROGRESS: [
    SupportTicketStatus.WAITING_CUSTOMER,
    SupportTicketStatus.RESOLVED,
    SupportTicketStatus.CLOSED,
  ],
  WAITING_CUSTOMER: [
    SupportTicketStatus.IN_PROGRESS,
    SupportTicketStatus.RESOLVED,
    SupportTicketStatus.CLOSED,
  ],
  RESOLVED: [SupportTicketStatus.IN_PROGRESS, SupportTicketStatus.CLOSED],
  CLOSED: [],
};

export const supportService = {
  createCustomer: async (userId: string, input: SupportTicketCreateInput) => {
    if (input.orderId) {
      const order = await prisma.order.findFirst({
        select: { id: true },
        where: { id: input.orderId, userId },
      });
      if (!order)
        throw new AppError(
          422,
          'SUPPORT_ORDER_INVALID',
          'The selected order does not belong to you.',
        );
    }
    const ticket = await prisma.$transaction(async (transaction) => {
      const created = await transaction.supportTicket.create({
        data: {
          messages: {
            create: {
              attachments: { create: attachmentCreate(input.attachments) },
              authorId: userId,
              authorRole: UserRole.CUSTOMER,
              body: input.body,
            },
          },
          ...(input.orderId ? { orderId: input.orderId } : {}),
          subject: input.subject,
          ticketNumber: createTicketNumber(),
          userId,
        },
        include: ticketDetailInclude,
      });
      await enqueueEmail(transaction, {
        deduplicationKey: `ticket:${created.id}:created`,
        notificationType: EmailNotificationType.SUPPORT_TICKET_CREATED,
        ...(created.orderId ? { orderId: created.orderId } : {}),
        payload: {
          customerName: `${created.user.firstName} ${created.user.lastName}`,
          subject: created.subject,
          ticketNumber: created.ticketNumber,
        },
        recipientEmail: created.user.email,
        subject: `Support ticket ${created.ticketNumber} created`,
        supportTicketId: created.id,
      });
      return created;
    });
    return { ticket: serializeDetail(ticket, false) };
  },

  listCustomer: async (userId: string, query: SupportTicketListQuery) => {
    const skip = (query.page - 1) * query.pageSize;
    const [totalItems, items] = await prisma.$transaction([
      prisma.supportTicket.count({ where: { userId } }),
      prisma.supportTicket.findMany({
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
        select: ticketSummarySelect,
        skip,
        take: query.pageSize,
        where: { userId },
      }),
    ]);
    return {
      items: items.map((ticket) => serializeSummary(ticket, false)),
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        totalItems,
        totalPages: Math.ceil(totalItems / query.pageSize),
      },
    };
  },

  getCustomer: async (userId: string, id: string) => ({
    ticket: serializeDetail(await getTicketOrThrow(id, userId), false),
  }),

  replyCustomer: async (userId: string, id: string, input: SupportMessageCreateInput) => {
    await prisma.$transaction(async (transaction) => {
      await transaction.$queryRaw`SELECT id FROM support_tickets WHERE id = ${id} FOR UPDATE`;
      const ticket = await transaction.supportTicket.findFirst({
        select: { id: true, status: true },
        where: { id, userId },
      });
      if (!ticket)
        throw new AppError(404, 'SUPPORT_TICKET_NOT_FOUND', 'The support ticket does not exist.');
      if (ticket.status === SupportTicketStatus.CLOSED)
        throw new AppError(
          409,
          'SUPPORT_TICKET_CLOSED',
          'A closed ticket cannot receive new messages.',
        );
      await transaction.supportMessage.create({
        data: {
          attachments: { create: attachmentCreate(input.attachments) },
          authorId: userId,
          authorRole: UserRole.CUSTOMER,
          body: input.body,
          ticketId: id,
        },
      });
      if (
        ticket.status === SupportTicketStatus.WAITING_CUSTOMER ||
        ticket.status === SupportTicketStatus.RESOLVED
      ) {
        await transaction.supportTicket.update({
          data: { resolvedAt: null, status: SupportTicketStatus.IN_PROGRESS },
          where: { id },
        });
      } else {
        await transaction.supportTicket.update({ data: {}, where: { id } });
      }
    });
    return { ticket: serializeDetail(await getTicketOrThrow(id, userId), false) };
  },

  listAdmin: async (query: AdminSupportTicketListQuery) => {
    const where: Prisma.SupportTicketWhereInput = {
      ...(query.assignedToId ? { assignedToId: query.assignedToId } : {}),
      ...(query.priority ? { priority: query.priority } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.q
        ? {
            OR: [
              { ticketNumber: { contains: query.q } },
              { subject: { contains: query.q } },
              { user: { email: { contains: query.q } } },
              { order: { orderNumber: { contains: query.q } } },
            ],
          }
        : {}),
    };
    const skip = (query.page - 1) * query.pageSize;
    const [totalItems, items] = await prisma.$transaction([
      prisma.supportTicket.count({ where }),
      prisma.supportTicket.findMany({
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
        select: ticketSummarySelect,
        skip,
        take: query.pageSize,
        where,
      }),
    ]);
    return {
      items: items.map((ticket) => serializeSummary(ticket)),
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        totalItems,
        totalPages: Math.ceil(totalItems / query.pageSize),
      },
    };
  },

  getAdmin: async (id: string) => ({ ticket: serializeDetail(await getTicketOrThrow(id)) }),

  replyAdmin: async (
    administratorId: string,
    id: string,
    input: SupportMessageCreateInput,
    audit: AdminAuditContext,
  ) => {
    await prisma.$transaction(async (transaction) => {
      await transaction.$queryRaw`SELECT id FROM support_tickets WHERE id = ${id} FOR UPDATE`;
      const ticket = await transaction.supportTicket.findUnique({
        select: {
          orderId: true,
          status: true,
          subject: true,
          ticketNumber: true,
          user: { select: { email: true, firstName: true, lastName: true } },
        },
        where: { id },
      });
      if (!ticket)
        throw new AppError(404, 'SUPPORT_TICKET_NOT_FOUND', 'The support ticket does not exist.');
      if (ticket.status === SupportTicketStatus.CLOSED)
        throw new AppError(
          409,
          'SUPPORT_TICKET_CLOSED',
          'A closed ticket cannot receive new messages.',
        );
      const message = await transaction.supportMessage.create({
        data: {
          attachments: { create: attachmentCreate(input.attachments) },
          authorId: administratorId,
          authorRole: UserRole.ADMIN,
          body: input.body,
          ticketId: id,
        },
      });
      const nextStatus = SupportTicketStatus.WAITING_CUSTOMER;
      await transaction.supportTicket.update({
        data: { resolvedAt: null, status: nextStatus },
        where: { id },
      });
      await enqueueEmail(transaction, {
        deduplicationKey: `ticket:${id}:admin-reply:${message.id}`,
        notificationType: EmailNotificationType.SUPPORT_ADMIN_REPLY,
        ...(ticket.orderId ? { orderId: ticket.orderId } : {}),
        payload: {
          customerName: `${ticket.user.firstName} ${ticket.user.lastName}`,
          subject: ticket.subject,
          ticketNumber: ticket.ticketNumber,
        },
        recipientEmail: ticket.user.email,
        subject: `New reply on ${ticket.ticketNumber}`,
        supportTicketId: id,
      });
      await recordAdminAudit(transaction, audit, {
        action: AdminAuditAction.SUPPORT_TICKET_REPLIED,
        entityId: id,
        entityType: AdminAuditEntityType.SUPPORT_TICKET,
        metadata: { messageId: message.id },
      });
      if (ticket.status !== nextStatus) {
        await recordAdminAudit(transaction, audit, {
          action: AdminAuditAction.SUPPORT_TICKET_STATUS_CHANGED,
          entityId: id,
          entityType: AdminAuditEntityType.SUPPORT_TICKET,
          metadata: { from: ticket.status, to: nextStatus },
        });
      }
    });
    return { ticket: serializeDetail(await getTicketOrThrow(id)) };
  },

  updateAdmin: async (
    id: string,
    input: AdminSupportTicketUpdateInput,
    audit: AdminAuditContext,
  ) => {
    await prisma.$transaction(async (transaction) => {
      await transaction.$queryRaw`SELECT id FROM support_tickets WHERE id = ${id} FOR UPDATE`;
      const ticket = await transaction.supportTicket.findUnique({
        select: {
          assignedToId: true,
          orderId: true,
          priority: true,
          status: true,
          ticketNumber: true,
          user: { select: { email: true, firstName: true, lastName: true } },
        },
        where: { id },
      });
      if (!ticket)
        throw new AppError(404, 'SUPPORT_TICKET_NOT_FOUND', 'The support ticket does not exist.');
      if (
        input.status &&
        input.status !== ticket.status &&
        !statusTransitions[ticket.status].includes(input.status)
      ) {
        throw new AppError(
          409,
          'SUPPORT_STATUS_TRANSITION_INVALID',
          'That ticket status transition is not allowed.',
          { currentStatus: ticket.status, requestedStatus: input.status },
        );
      }
      if (input.assignedToId) {
        const assignee = await transaction.user.findFirst({
          select: { id: true },
          where: { id: input.assignedToId, role: UserRole.ADMIN, status: 'ACTIVE' },
        });
        if (!assignee)
          throw new AppError(
            422,
            'SUPPORT_ASSIGNEE_INVALID',
            'Tickets may only be assigned to an active administrator.',
          );
      }
      const nextStatus = input.status ?? ticket.status;
      await transaction.supportTicket.update({
        data: {
          ...(input.assignedToId !== undefined ? { assignedToId: input.assignedToId } : {}),
          ...(input.priority ? { priority: input.priority } : {}),
          ...(input.status ? { status: input.status } : {}),
          ...(nextStatus === SupportTicketStatus.RESOLVED && ticket.status !== nextStatus
            ? { resolvedAt: new Date() }
            : {}),
          ...(nextStatus !== SupportTicketStatus.RESOLVED ? { resolvedAt: null } : {}),
          ...(nextStatus === SupportTicketStatus.CLOSED && ticket.status !== nextStatus
            ? { closedAt: new Date() }
            : {}),
        },
        where: { id },
      });
      if (input.assignedToId !== undefined && input.assignedToId !== ticket.assignedToId) {
        await recordAdminAudit(transaction, audit, {
          action: AdminAuditAction.SUPPORT_TICKET_ASSIGNED,
          entityId: id,
          entityType: AdminAuditEntityType.SUPPORT_TICKET,
          metadata: { from: ticket.assignedToId, to: input.assignedToId },
        });
      }
      if (input.priority && input.priority !== ticket.priority) {
        await recordAdminAudit(transaction, audit, {
          action: AdminAuditAction.SUPPORT_TICKET_PRIORITY_CHANGED,
          entityId: id,
          entityType: AdminAuditEntityType.SUPPORT_TICKET,
          metadata: { from: ticket.priority, to: input.priority },
        });
      }
      if (input.status && input.status !== ticket.status) {
        await recordAdminAudit(transaction, audit, {
          action: AdminAuditAction.SUPPORT_TICKET_STATUS_CHANGED,
          entityId: id,
          entityType: AdminAuditEntityType.SUPPORT_TICKET,
          metadata: { from: ticket.status, to: input.status },
        });
        if (input.status === SupportTicketStatus.RESOLVED) {
          await enqueueEmail(transaction, {
            deduplicationKey: `ticket:${id}:resolved:${randomUUID()}`,
            notificationType: EmailNotificationType.SUPPORT_TICKET_RESOLVED,
            ...(ticket.orderId ? { orderId: ticket.orderId } : {}),
            payload: {
              customerName: `${ticket.user.firstName} ${ticket.user.lastName}`,
              ticketNumber: ticket.ticketNumber,
            },
            recipientEmail: ticket.user.email,
            subject: `Support ticket ${ticket.ticketNumber} resolved`,
            supportTicketId: id,
          });
        }
      }
    });
    return { ticket: serializeDetail(await getTicketOrThrow(id)) };
  },
};
