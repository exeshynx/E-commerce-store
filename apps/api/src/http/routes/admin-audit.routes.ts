import { Router } from 'express';
import { adminAuditListQuerySchema } from '../../core/audit/audit.schemas.js';
import { auditService } from '../../core/audit/audit.service.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';

export const adminAuditRouter = Router();
adminAuditRouter.use(authenticate, authorize('ADMIN'));

adminAuditRouter.get('/audit', async (request, response) => {
  response.json({
    data: await auditService.list(adminAuditListQuerySchema.parse(request.query)),
    requestId: request.id,
  });
});
