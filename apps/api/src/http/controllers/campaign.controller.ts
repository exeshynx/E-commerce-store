import type { RequestHandler } from 'express';
import { campaignService } from '../../core/campaigns/campaign.service.js';
import { campaignCreateSchema, campaignIdSchema } from '../../core/campaigns/campaign.schemas.js';
import { AppError } from '../errors/app-error.js';

const auditContext = (request: Express.Request) => {
  if (!request.auth)
    throw new AppError(401, 'AUTHENTICATION_REQUIRED', 'Authentication is required.');
  return { administratorId: request.auth.userId, requestId: request.id };
};

export const listCampaigns: RequestHandler = async (request, response) => {
  response.json({ data: await campaignService.list(), requestId: request.id });
};

export const createCampaign: RequestHandler = async (request, response) => {
  response.status(201).json({
    data: {
      campaign: await campaignService.create(
        campaignCreateSchema.parse(request.body),
        auditContext(request),
      ),
    },
    requestId: request.id,
  });
};

export const queueCampaign: RequestHandler = async (request, response) => {
  response.json({
    data: {
      campaign: await campaignService.queue(
        campaignIdSchema.parse(request.params.id),
        auditContext(request),
      ),
    },
    requestId: request.id,
  });
};
