import { Router } from 'express';
import { orderIdSchema } from '../../core/orders/order.schemas.js';
import {
  adminShipmentListQuerySchema,
  shipmentCreateSchema,
  shipmentEventCreateSchema,
  shipmentIdSchema,
  shipmentUpdateSchema,
} from '../../core/shipments/shipment.schemas.js';
import { shipmentService } from '../../core/shipments/shipment.service.js';
import { AppError } from '../errors/app-error.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';

export const adminShipmentRouter = Router();
adminShipmentRouter.use(authenticate, authorize('ADMIN'));

const auditContext = (request: Express.Request) => {
  if (!request.auth) {
    throw new AppError(401, 'AUTHENTICATION_REQUIRED', 'Authentication is required.');
  }
  return { administratorId: request.auth.userId, requestId: request.id };
};

adminShipmentRouter.get('/shipments', async (request, response) => {
  response.json({
    data: await shipmentService.listAdmin(adminShipmentListQuerySchema.parse(request.query)),
    requestId: request.id,
  });
});

adminShipmentRouter.get('/shipments/:id', async (request, response) => {
  response.json({
    data: await shipmentService.getAdmin(shipmentIdSchema.parse(request.params.id)),
    requestId: request.id,
  });
});

adminShipmentRouter.post('/orders/:id/shipments', async (request, response) => {
  response.status(201).json({
    data: await shipmentService.create(
      orderIdSchema.parse(request.params.id),
      shipmentCreateSchema.parse(request.body),
      auditContext(request),
    ),
    requestId: request.id,
  });
});

adminShipmentRouter.patch('/shipments/:id', async (request, response) => {
  response.json({
    data: await shipmentService.update(
      shipmentIdSchema.parse(request.params.id),
      shipmentUpdateSchema.parse(request.body),
      auditContext(request),
    ),
    requestId: request.id,
  });
});

adminShipmentRouter.post('/shipments/:id/events', async (request, response) => {
  response.status(201).json({
    data: await shipmentService.addEvent(
      shipmentIdSchema.parse(request.params.id),
      shipmentEventCreateSchema.parse(request.body),
      auditContext(request),
    ),
    requestId: request.id,
  });
});
