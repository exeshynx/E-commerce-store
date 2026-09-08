import type { RequestHandler } from 'express';
import { commerceActivityService } from '../../core/admin/commerce-activity.service.js';

export const getCommerceActivity: RequestHandler = async (request, response) => {
  response.json({ data: await commerceActivityService.getOverview(), requestId: request.id });
};
