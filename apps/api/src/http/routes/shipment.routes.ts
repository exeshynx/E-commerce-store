import { Router } from 'express';
import { orderIdSchema } from '../../core/orders/order.schemas.js';
import { shipmentService } from '../../core/shipments/shipment.service.js';
import { AppError } from '../errors/app-error.js';
import { authenticate } from '../middleware/authenticate.js';

export const shipmentRouter = Router();

shipmentRouter.get('/orders/:id/shipments', authenticate, async (request, response) => {
  if (!request.auth) {
    throw new AppError(401, 'AUTHENTICATION_REQUIRED', 'Authentication is required.');
  }
  response.json({
    data: await shipmentService.getCustomerOrderTracking(
      request.auth.userId,
      orderIdSchema.parse(request.params.id),
    ),
    requestId: request.id,
  });
});
