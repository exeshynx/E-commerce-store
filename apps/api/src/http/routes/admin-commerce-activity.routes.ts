import { Router } from 'express';
import { getCommerceActivity } from '../controllers/commerce-activity.controller.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';

export const adminCommerceActivityRouter = Router();
adminCommerceActivityRouter.use(authenticate, authorize('ADMIN'));
adminCommerceActivityRouter.get('/commerce-activity', getCommerceActivity);
