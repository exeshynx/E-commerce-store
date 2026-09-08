import { Router } from 'express';
import {
  supportMessageCreateSchema,
  supportTicketCreateSchema,
  supportTicketListQuerySchema,
  ticketIdSchema,
} from '../../core/support/support.schemas.js';
import { supportService } from '../../core/support/support.service.js';
import { AppError } from '../errors/app-error.js';
import { authenticate } from '../middleware/authenticate.js';

export const supportRouter = Router();

const userId = (auth: Express.Request['auth']) => {
  if (!auth) throw new AppError(401, 'AUTHENTICATION_REQUIRED', 'Authentication is required.');
  return auth.userId;
};

supportRouter.post('/tickets', authenticate, async (request, response) => {
  response.status(201).json({
    data: await supportService.createCustomer(
      userId(request.auth),
      supportTicketCreateSchema.parse(request.body),
    ),
    requestId: request.id,
  });
});

supportRouter.get('/tickets', authenticate, async (request, response) => {
  response.json({
    data: await supportService.listCustomer(
      userId(request.auth),
      supportTicketListQuerySchema.parse(request.query),
    ),
    requestId: request.id,
  });
});

supportRouter.get('/tickets/:id', authenticate, async (request, response) => {
  response.json({
    data: await supportService.getCustomer(
      userId(request.auth),
      ticketIdSchema.parse(request.params.id),
    ),
    requestId: request.id,
  });
});

supportRouter.post('/tickets/:id/messages', authenticate, async (request, response) => {
  response.status(201).json({
    data: await supportService.replyCustomer(
      userId(request.auth),
      ticketIdSchema.parse(request.params.id),
      supportMessageCreateSchema.parse(request.body),
    ),
    requestId: request.id,
  });
});
