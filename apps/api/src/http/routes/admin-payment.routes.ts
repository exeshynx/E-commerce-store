import { Router } from 'express';
import { idempotencyKeySchema, orderIdSchema } from '../../core/orders/order.schemas.js';
import {
  adminPaymentListQuerySchema,
  manualPaymentStatusUpdateSchema,
  paymentAttemptIdSchema,
  paymentRefundSchema,
} from '../../core/payments/payment.schemas.js';
import { paymentService } from '../../core/payments/payment.service.js';
import { AppError } from '../errors/app-error.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';

export const adminPaymentRouter = Router();

adminPaymentRouter.use(authenticate, authorize('ADMIN'));

const getAdministratorId = (auth: Express.Request['auth']) => {
  if (!auth) throw new AppError(401, 'AUTHENTICATION_REQUIRED', 'Authentication is required.');
  return auth.userId;
};

adminPaymentRouter.get('/payments', async (request, response) => {
  response.json({
    data: await paymentService.listAdminPayments(adminPaymentListQuerySchema.parse(request.query)),
    requestId: request.id,
  });
});

adminPaymentRouter.get('/payments/:id', async (request, response) => {
  response.json({
    data: await paymentService.getAdminPayment(paymentAttemptIdSchema.parse(request.params.id)),
    requestId: request.id,
  });
});

adminPaymentRouter.get('/orders/:id/payments', async (request, response) => {
  response.json({
    data: await paymentService.listAdminOrderPayments(orderIdSchema.parse(request.params.id)),
    requestId: request.id,
  });
});

adminPaymentRouter.post('/orders/:id/payments/manual', async (request, response) => {
  response.status(201).json({
    data: await paymentService.createAdminManualAttempt(
      getAdministratorId(request.auth),
      orderIdSchema.parse(request.params.id),
    ),
    requestId: request.id,
  });
});

adminPaymentRouter.patch('/payments/:id/status', async (request, response) => {
  response.json({
    data: await paymentService.updateManualPaymentStatus(
      paymentAttemptIdSchema.parse(request.params.id),
      getAdministratorId(request.auth),
      manualPaymentStatusUpdateSchema.parse(request.body),
    ),
    requestId: request.id,
  });
});

adminPaymentRouter.post('/payments/:id/refunds', async (request, response) => {
  response.status(201).json({
    data: await paymentService.createRefund(
      paymentAttemptIdSchema.parse(request.params.id),
      getAdministratorId(request.auth),
      idempotencyKeySchema.parse(request.header('idempotency-key')),
      paymentRefundSchema.parse(request.body),
      request.id,
    ),
    requestId: request.id,
  });
});
