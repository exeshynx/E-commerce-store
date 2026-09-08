import { Router } from 'express';
import {
  adminReviewListQuerySchema,
  adminReviewUpdateSchema,
  reviewIdSchema,
} from '../../core/reviews/review.schemas.js';
import { reviewService } from '../../core/reviews/review.service.js';
import { AppError } from '../errors/app-error.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';

export const adminReviewRouter = Router();
adminReviewRouter.use(authenticate, authorize('ADMIN'));

const adminId = (auth: Express.Request['auth']) => {
  if (!auth) throw new AppError(401, 'AUTHENTICATION_REQUIRED', 'Authentication is required.');
  return auth.userId;
};

adminReviewRouter.get('/reviews', async (request, response) => {
  response.json({
    data: await reviewService.listAdminReviews(adminReviewListQuerySchema.parse(request.query)),
    requestId: request.id,
  });
});

adminReviewRouter.patch('/reviews/:id', async (request, response) => {
  response.json({
    data: {
      review: await reviewService.moderateReview(
        adminId(request.auth),
        request.id,
        reviewIdSchema.parse(request.params.id),
        adminReviewUpdateSchema.parse(request.body),
      ),
    },
    requestId: request.id,
  });
});
