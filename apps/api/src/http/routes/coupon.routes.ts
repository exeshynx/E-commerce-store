import { Router } from 'express';
import { couponCodeSchema, couponPreviewSchema } from '../../core/promotions/coupon.schemas.js';
import { couponService } from '../../core/promotions/coupon.service.js';
import { AppError } from '../errors/app-error.js';
import { authenticate } from '../middleware/authenticate.js';

export const couponRouter = Router();

couponRouter.post('/coupons/validate', authenticate, async (request, response) => {
  if (!request.auth)
    throw new AppError(401, 'AUTHENTICATION_REQUIRED', 'Authentication is required.');
  const input = couponPreviewSchema.parse(request.body);
  response.json({
    data: {
      coupon: await couponService.previewCartCoupon(
        request.auth.userId,
        couponCodeSchema.parse(input.code),
      ),
    },
    requestId: request.id,
  });
});
