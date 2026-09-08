import { CampaignAudience } from '@prisma/client';
import { z } from 'zod';

export const campaignCreateSchema = z.object({
  audience: z.nativeEnum(CampaignAudience),
  message: z.string().trim().min(1).max(10_000),
  name: z.string().trim().min(2).max(160),
  subject: z.string().trim().min(2).max(255),
});

export const campaignIdSchema = z.uuid();

export type CampaignCreateInput = z.infer<typeof campaignCreateSchema>;
