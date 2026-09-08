import type { AdminAuditAction, AdminAuditEntityType, Prisma, PrismaClient } from '@prisma/client';
import { prisma } from '../../infrastructure/database/prisma.js';
import type { AdminAuditListQuery } from './audit.schemas.js';

export type AdminAuditContext = {
  administratorId: string;
  requestId?: string;
};

type AuditWriter = Prisma.TransactionClient | PrismaClient;

export const recordAdminAudit = (
  database: AuditWriter,
  context: AdminAuditContext,
  input: {
    action: AdminAuditAction;
    entityId: string;
    entityType: AdminAuditEntityType;
    metadata?: Prisma.InputJsonValue;
  },
) =>
  database.adminAuditLog.create({
    data: {
      action: input.action,
      administratorId: context.administratorId,
      entityId: input.entityId,
      entityType: input.entityType,
      ...(input.metadata === undefined ? {} : { metadata: input.metadata }),
      ...(context.requestId ? { requestId: context.requestId } : {}),
    },
  });

export const auditService = {
  list: async (query: AdminAuditListQuery) => {
    const where: Prisma.AdminAuditLogWhereInput = {
      ...(query.action ? { action: query.action } : {}),
      ...(query.entityType ? { entityType: query.entityType } : {}),
      ...(query.q
        ? {
            OR: [
              { entityId: { contains: query.q } },
              { administrator: { email: { contains: query.q } } },
              { administrator: { firstName: { contains: query.q } } },
              { administrator: { lastName: { contains: query.q } } },
            ],
          }
        : {}),
    };
    const skip = (query.page - 1) * query.pageSize;
    const [totalItems, items] = await prisma.$transaction([
      prisma.adminAuditLog.count({ where }),
      prisma.adminAuditLog.findMany({
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        select: {
          action: true,
          administrator: {
            select: { email: true, firstName: true, id: true, lastName: true },
          },
          createdAt: true,
          entityId: true,
          entityType: true,
          id: true,
          metadata: true,
          requestId: true,
        },
        skip,
        take: query.pageSize,
        where,
      }),
    ]);

    return {
      items: items.map((item) => ({ ...item, createdAt: item.createdAt.toISOString() })),
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        totalItems,
        totalPages: Math.ceil(totalItems / query.pageSize),
      },
    };
  },
};
