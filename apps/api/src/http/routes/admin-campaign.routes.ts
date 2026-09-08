import { Router } from 'express';
import {
  createCampaign,
  listCampaigns,
  queueCampaign,
} from '../controllers/campaign.controller.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';

export const adminCampaignRouter = Router();
adminCampaignRouter.use(authenticate, authorize('ADMIN'));
adminCampaignRouter.get('/campaigns', listCampaigns);
adminCampaignRouter.post('/campaigns', createCampaign);
adminCampaignRouter.post('/campaigns/:id/queue', queueCampaign);
