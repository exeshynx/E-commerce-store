import { Router } from 'express';
import { idempotencyKeySchema, orderIdSchema } from '../../core/orders/order.schemas.js';
import { paymentService } from '../../core/payments/payment.service.js';
import { AppError } from '../errors/app-error.js';
import { resolveShopper } from '../middleware/resolve-shopper.js';

export const paymentRouter = Router();

const getUserId = (shopper: Express.Request['shopper']) => {
  if (!shopper) throw new AppError(400, 'SHOPPER_IDENTITY_REQUIRED', 'A shopper is required.');
  return shopper.userId;
};

paymentRouter.get('/orders/:id/payments', resolveShopper, async (request, response) => {
  response.json({
    data: await paymentService.listCustomerOrderPayments(
      getUserId(request.shopper),
      orderIdSchema.parse(request.params.id),
    ),
    requestId: request.id,
  });
});

paymentRouter.post('/orders/:id/payments/manual', resolveShopper, async (request, response) => {
  response.status(201).json({
    data: await paymentService.createCustomerManualAttempt(
      getUserId(request.shopper),
      orderIdSchema.parse(request.params.id),
    ),
    requestId: request.id,
  });
});

paymentRouter.post('/orders/:id/payments/safepay', resolveShopper, async (request, response) => {
  response.status(201).json({
    data: await paymentService.createCustomerSafepayAttempt(
      getUserId(request.shopper),
      orderIdSchema.parse(request.params.id),
      idempotencyKeySchema.parse(request.header('idempotency-key')),
    ),
    requestId: request.id,
  });
});
