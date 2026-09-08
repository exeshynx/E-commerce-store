import { Router } from 'express';
import {
  adminCouponListQuerySchema,
  couponCreateSchema,
  couponIdSchema,
  couponUpdateSchema,
} from '../../core/promotions/coupon.schemas.js';
import { couponService } from '../../core/promotions/coupon.service.js';
import { AppError } from '../errors/app-error.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';

export const adminCouponRouter = Router();
adminCouponRouter.use(authenticate, authorize('ADMIN'));

const audit = (request: Express.Request) => {
  if (!request.auth)
    throw new AppError(401, 'AUTHENTICATION_REQUIRED', 'Authentication is required.');
  return { administratorId: request.auth.userId, requestId: request.id };
};

adminCouponRouter.get('/coupons', async (request, response) => {
  response.json({
    data: await couponService.listCoupons(adminCouponListQuerySchema.parse(request.query)),
    requestId: request.id,
  });
});

adminCouponRouter.post('/coupons', async (request, response) => {
  response.status(201).json({
    data: {
      coupon: await couponService.createCoupon(
        couponCreateSchema.parse(request.body),
        audit(request),
      ),
    },
    requestId: request.id,
  });
});

adminCouponRouter.patch('/coupons/:id', async (request, response) => {
  response.json({
    data: {
      coupon: await couponService.updateCoupon(
        couponIdSchema.parse(request.params.id),
        couponUpdateSchema.parse(request.body),
        audit(request),
      ),
    },
    requestId: request.id,
  });
});
