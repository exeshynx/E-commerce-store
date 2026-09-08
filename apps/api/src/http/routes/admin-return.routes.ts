import { Router } from 'express';
import {
  adminReturnListQuerySchema,
  adminReturnUpdateSchema,
  returnIdSchema,
} from '../../core/returns/return.schemas.js';
import { returnService } from '../../core/returns/return.service.js';
import { AppError } from '../errors/app-error.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';

export const adminReturnRouter = Router();
adminReturnRouter.use(authenticate, authorize('ADMIN'));

const auditContext = (request: Express.Request) => {
  if (!request.auth)
    throw new AppError(401, 'AUTHENTICATION_REQUIRED', 'Authentication is required.');
  return { administratorId: request.auth.userId, requestId: request.id };
};

adminReturnRouter.get('/returns', async (request, response) => {
  response.json({
    data: await returnService.listAdmin(adminReturnListQuerySchema.parse(request.query)),
    requestId: request.id,
  });
});

adminReturnRouter.get('/returns/:id', async (request, response) => {
  response.json({
    data: await returnService.getAdmin(returnIdSchema.parse(request.params.id)),
    requestId: request.id,
  });
});

adminReturnRouter.patch('/returns/:id', async (request, response) => {
  response.json({
    data: await returnService.updateAdmin(
      returnIdSchema.parse(request.params.id),
      adminReturnUpdateSchema.parse(request.body),
      auditContext(request),
    ),
    requestId: request.id,
  });
});
