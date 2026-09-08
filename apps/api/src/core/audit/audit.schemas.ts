import { AdminAuditAction, AdminAuditEntityType } from '@prisma/client';
import { z } from 'zod';

export const adminAuditListQuerySchema = z.object({
  action: z.enum(AdminAuditAction).optional(),
  entityType: z.enum(AdminAuditEntityType).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  q: z.string().trim().max(120).optional(),
});

export type AdminAuditListQuery = z.infer<typeof adminAuditListQuerySchema>;
