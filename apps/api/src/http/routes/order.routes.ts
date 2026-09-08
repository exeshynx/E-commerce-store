import { Router } from 'express';
import {
  checkoutSchema,
  idempotencyKeySchema,
  orderIdSchema,
  orderListQuerySchema,
} from '../../core/orders/order.schemas.js';
import { orderService } from '../../core/orders/order.service.js';
import { AppError } from '../errors/app-error.js';
import { authenticate } from '../middleware/authenticate.js';
import { resolveShopper } from '../middleware/resolve-shopper.js';

export const orderRouter = Router();

const getUserId = (auth: Express.Request['auth']) => {
  if (!auth) throw new AppError(401, 'AUTHENTICATION_REQUIRED', 'Authentication is required.');
  return auth.userId;
};

const getShopperId = (shopper: Express.Request['shopper']) => {
  if (!shopper) throw new AppError(400, 'SHOPPER_IDENTITY_REQUIRED', 'A shopper is required.');
  return shopper.userId;
};

orderRouter.post('/checkout', resolveShopper, async (request, response) => {
  const rawIdempotencyKey = request.header('idempotency-key');
  if (!rawIdempotencyKey) {
    throw new AppError(
      400,
      'IDEMPOTENCY_KEY_REQUIRED',
      'The Idempotency-Key header is required for checkout.',
    );
  }
  const result = await orderService.checkout(
    getShopperId(request.shopper),
    idempotencyKeySchema.parse(rawIdempotencyKey),
    checkoutSchema.parse(request.body),
  );
  response.status(result.created ? 201 : 200).json({
    data: { order: result.order },
    requestId: request.id,
  });
});

orderRouter.get('/orders', authenticate, async (request, response) => {
  response.json({
    data: {
      ...(await orderService.listOrders(
        getUserId(request.auth),
        orderListQuerySchema.parse(request.query),
      )),
    },
    requestId: request.id,
  });
});

orderRouter.get('/orders/:id', resolveShopper, async (request, response) => {
  response.json({
    data: {
      order: await orderService.getOrder(
        getShopperId(request.shopper),
        orderIdSchema.parse(request.params.id),
      ),
    },
    requestId: request.id,
  });
});
