import { Router } from 'express';
import {
  addressCreateSchema,
  addressIdSchema,
  addressUpdateSchema,
  changePasswordSchema,
  profileUpdateSchema,
} from '../../core/account/account.schemas.js';
import { accountService } from '../../core/account/account.service.js';
import { AppError } from '../errors/app-error.js';
import { authenticate } from '../middleware/authenticate.js';

export const accountRouter = Router();

const userId = (auth: Express.Request['auth']) => {
  if (!auth) throw new AppError(401, 'AUTHENTICATION_REQUIRED', 'Authentication is required.');
  return auth.userId;
};

accountRouter.get('/addresses', authenticate, async (request, response) => {
  response.json({
    data: { items: await accountService.listAddresses(userId(request.auth)) },
    requestId: request.id,
  });
});

accountRouter.post('/addresses', authenticate, async (request, response) => {
  response.status(201).json({
    data: {
      address: await accountService.createAddress(
        userId(request.auth),
        addressCreateSchema.parse(request.body),
      ),
    },
    requestId: request.id,
  });
});

accountRouter.patch('/addresses/:id', authenticate, async (request, response) => {
  response.json({
    data: {
      address: await accountService.updateAddress(
        userId(request.auth),
        addressIdSchema.parse(request.params.id),
        addressUpdateSchema.parse(request.body),
      ),
    },
    requestId: request.id,
  });
});

accountRouter.delete('/addresses/:id', authenticate, async (request, response) => {
  await accountService.deleteAddress(
    userId(request.auth),
    addressIdSchema.parse(request.params.id),
  );
  response.status(204).send();
});

accountRouter.get('/account/summary', authenticate, async (request, response) => {
  response.json({
    data: await accountService.getAccountSummary(userId(request.auth)),
    requestId: request.id,
  });
});

accountRouter.patch('/account/profile', authenticate, async (request, response) => {
  response.json({
    data: {
      user: await accountService.updateProfile(
        userId(request.auth),
        profileUpdateSchema.parse(request.body),
      ),
    },
    requestId: request.id,
  });
});

accountRouter.post('/account/change-password', authenticate, async (request, response) => {
  await accountService.changePassword(
    userId(request.auth),
    changePasswordSchema.parse(request.body),
  );
  response.status(204).send();
});
