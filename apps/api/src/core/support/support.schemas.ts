import { SupportTicketPriority, SupportTicketStatus } from '@prisma/client';
import { z } from 'zod';

const paginationShape = {
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(10),
};

export const ticketIdSchema = z.uuid();

export const attachmentMetadataSchema = z
  .object({
    checksum: z
      .string()
      .trim()
      .regex(/^[a-fA-F0-9]{64}$/)
      .optional(),
    fileName: z.string().trim().min(1).max(255),
    mediaType: z
      .string()
      .trim()
      .min(3)
      .max(120)
      .regex(/^[a-zA-Z0-9][a-zA-Z0-9.+-]*\/[a-zA-Z0-9][a-zA-Z0-9.+-]*$/),
    sizeBytes: z.coerce
      .number()
      .int()
      .min(1)
      .max(10 * 1024 * 1024),
  })
  .strict();

const messageShape = {
  attachments: z.array(attachmentMetadataSchema).max(5).default([]),
  body: z.string().trim().min(1).max(10_000),
};

export const supportTicketCreateSchema = z
  .object({
    ...messageShape,
    orderId: z.uuid().optional(),
    subject: z.string().trim().min(3).max(180),
  })
  .strict();

export const supportMessageCreateSchema = z.object(messageShape).strict();

export const supportTicketListQuerySchema = z.object({ ...paginationShape });

export const adminSupportTicketListQuerySchema = z.object({
  ...paginationShape,
  assignedToId: z.uuid().optional(),
  priority: z.enum(SupportTicketPriority).optional(),
  q: z.string().trim().max(120).optional(),
  status: z.enum(SupportTicketStatus).optional(),
});

export const adminSupportTicketUpdateSchema = z
  .object({
    assignedToId: z.uuid().nullable().optional(),
    priority: z.enum(SupportTicketPriority).optional(),
    status: z.enum(SupportTicketStatus).optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, 'At least one field is required.');

export type SupportTicketCreateInput = z.infer<typeof supportTicketCreateSchema>;
export type SupportMessageCreateInput = z.infer<typeof supportMessageCreateSchema>;
export type SupportTicketListQuery = z.infer<typeof supportTicketListQuerySchema>;
export type AdminSupportTicketListQuery = z.infer<typeof adminSupportTicketListQuerySchema>;
export type AdminSupportTicketUpdateInput = z.infer<typeof adminSupportTicketUpdateSchema>;
