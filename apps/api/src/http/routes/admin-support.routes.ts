import { Router } from 'express';
import {
  adminSupportTicketListQuerySchema,
  adminSupportTicketUpdateSchema,
  supportMessageCreateSchema,
  ticketIdSchema,
} from '../../core/support/support.schemas.js';
import { supportService } from '../../core/support/support.service.js';
import { AppError } from '../errors/app-error.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';

export const adminSupportRouter = Router();
adminSupportRouter.use(authenticate, authorize('ADMIN'));

const auditContext = (request: Express.Request) => {
  if (!request.auth)
    throw new AppError(401, 'AUTHENTICATION_REQUIRED', 'Authentication is required.');
  return { administratorId: request.auth.userId, requestId: request.id };
};

adminSupportRouter.get('/tickets', async (request, response) => {
  response.json({
    data: await supportService.listAdmin(adminSupportTicketListQuerySchema.parse(request.query)),
    requestId: request.id,
  });
});

adminSupportRouter.get('/tickets/:id', async (request, response) => {
  response.json({
    data: await supportService.getAdmin(ticketIdSchema.parse(request.params.id)),
    requestId: request.id,
  });
});

adminSupportRouter.patch('/tickets/:id', async (request, response) => {
  response.json({
    data: await supportService.updateAdmin(
      ticketIdSchema.parse(request.params.id),
      adminSupportTicketUpdateSchema.parse(request.body),
      auditContext(request),
    ),
    requestId: request.id,
  });
});

adminSupportRouter.post('/tickets/:id/messages', async (request, response) => {
  if (!request.auth)
    throw new AppError(401, 'AUTHENTICATION_REQUIRED', 'Authentication is required.');
  response.status(201).json({
    data: await supportService.replyAdmin(
      request.auth.userId,
      ticketIdSchema.parse(request.params.id),
      supportMessageCreateSchema.parse(request.body),
      auditContext(request),
    ),
    requestId: request.id,
  });
});
