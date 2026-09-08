import { Router } from 'express';
import {
  reviewCreateSchema,
  reviewIdSchema,
  reviewListQuerySchema,
  reviewUpdateSchema,
} from '../../core/reviews/review.schemas.js';
import { reviewService } from '../../core/reviews/review.service.js';
import { AppError } from '../errors/app-error.js';
import { authenticate, optionalAuthenticate } from '../middleware/authenticate.js';

export const reviewRouter = Router();

const userId = (auth: Express.Request['auth']) => {
  if (!auth) throw new AppError(401, 'AUTHENTICATION_REQUIRED', 'Authentication is required.');
  return auth.userId;
};

reviewRouter.get('/products/:id/reviews', optionalAuthenticate, async (request, response) => {
  response.json({
    data: await reviewService.listProductReviews(
      reviewIdSchema.parse(request.params.id),
      reviewListQuerySchema.parse(request.query),
      request.auth?.userId,
    ),
    requestId: request.id,
  });
});

reviewRouter.post('/products/:id/reviews', authenticate, async (request, response) => {
  response.status(201).json({
    data: {
      review: await reviewService.createReview(
        userId(request.auth),
        reviewIdSchema.parse(request.params.id),
        reviewCreateSchema.parse(request.body),
      ),
    },
    requestId: request.id,
  });
});

reviewRouter.patch('/reviews/:id', authenticate, async (request, response) => {
  response.json({
    data: {
      review: await reviewService.updateReview(
        userId(request.auth),
        reviewIdSchema.parse(request.params.id),
        reviewUpdateSchema.parse(request.body),
      ),
    },
    requestId: request.id,
  });
});

reviewRouter.delete('/reviews/:id', authenticate, async (request, response) => {
  await reviewService.deleteReview(userId(request.auth), reviewIdSchema.parse(request.params.id));
  response.status(204).send();
});
