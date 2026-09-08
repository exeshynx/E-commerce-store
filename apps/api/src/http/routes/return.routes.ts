import { Router } from 'express';
import {
  returnCreateSchema,
  returnIdSchema,
  returnListQuerySchema,
} from '../../core/returns/return.schemas.js';
import { returnService } from '../../core/returns/return.service.js';
import { AppError } from '../errors/app-error.js';
import { authenticate } from '../middleware/authenticate.js';

export const returnRouter = Router();

const userId = (auth: Express.Request['auth']) => {
  if (!auth) throw new AppError(401, 'AUTHENTICATION_REQUIRED', 'Authentication is required.');
  return auth.userId;
};

returnRouter.post('/returns', authenticate, async (request, response) => {
  response.status(201).json({
    data: await returnService.create(userId(request.auth), returnCreateSchema.parse(request.body)),
    requestId: request.id,
  });
});

returnRouter.get('/returns', authenticate, async (request, response) => {
  response.json({
    data: await returnService.listCustomer(
      userId(request.auth),
      returnListQuerySchema.parse(request.query),
    ),
    requestId: request.id,
  });
});

returnRouter.get('/returns/:id', authenticate, async (request, response) => {
  response.json({
    data: await returnService.getCustomer(
      userId(request.auth),
      returnIdSchema.parse(request.params.id),
    ),
    requestId: request.id,
  });
});
