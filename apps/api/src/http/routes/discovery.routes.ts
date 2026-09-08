import { Router } from 'express';
import {
  autocompleteQuerySchema,
  productViewSchema,
  recommendationQuerySchema,
  searchQuerySchema,
} from '../../core/discovery/discovery.schemas.js';
import { discoveryService } from '../../core/discovery/discovery.service.js';
import { AppError } from '../errors/app-error.js';
import { authenticate, optionalAuthenticate } from '../middleware/authenticate.js';

export const discoveryRouter = Router();

discoveryRouter.get('/search', async (request, response) => {
  response.json({
    data: await discoveryService.search(searchQuerySchema.parse(request.query)),
    requestId: request.id,
  });
});

discoveryRouter.get('/search/suggestions', async (request, response) => {
  const query = autocompleteQuerySchema.parse(request.query);
  response.json({
    data: { items: await discoveryService.autocomplete(query.q, query.limit) },
    requestId: request.id,
  });
});

discoveryRouter.get('/recommendations', optionalAuthenticate, async (request, response) => {
  response.json({
    data: await discoveryService.recommendations(
      recommendationQuerySchema.parse(request.query),
      request.auth?.userId,
    ),
    requestId: request.id,
  });
});

discoveryRouter.post('/products/:id/view', authenticate, async (request, response) => {
  if (!request.auth)
    throw new AppError(401, 'AUTHENTICATION_REQUIRED', 'Authentication is required.');
  await discoveryService.recordView(
    request.auth.userId,
    productViewSchema.parse({ productId: request.params.id }).productId,
  );
  response.status(204).send();
});
