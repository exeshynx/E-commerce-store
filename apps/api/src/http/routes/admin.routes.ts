import { Router } from 'express';
import { AdminAuditAction } from '@prisma/client';
import { adminService } from '../../core/admin/admin.service.js';
import {
  adminCategoryListQuerySchema,
  adminInventoryListQuerySchema,
  adminOrderListQuerySchema,
  adminProductListQuerySchema,
  adminUserListQuerySchema,
  inventoryUpdateSchema,
  orderStatusUpdateSchema,
} from '../../core/admin/admin.schemas.js';
import { catalogIdSchema } from '../../core/catalog/catalog.schemas.js';
import { catalogService } from '../../core/catalog/catalog.service.js';
import { AppError } from '../errors/app-error.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';

export const adminRouter = Router();

adminRouter.use(authenticate, authorize('ADMIN'));

const getAdministratorId = (auth: Express.Request['auth']) => {
  if (!auth) throw new AppError(401, 'AUTHENTICATION_REQUIRED', 'Authentication is required.');
  return auth.userId;
};

const auditContext = (request: Express.Request, action?: AdminAuditAction) => ({
  ...(action ? { action } : {}),
  administratorId: getAdministratorId(request.auth),
  requestId: request.id,
});

adminRouter.get('/dashboard', async (request, response) => {
  response.json({ data: await adminService.getDashboard(), requestId: request.id });
});

adminRouter.get('/products', async (request, response) => {
  response.json({
    data: await adminService.listProducts(adminProductListQuerySchema.parse(request.query)),
    requestId: request.id,
  });
});

adminRouter.get('/products/:id', async (request, response) => {
  response.json({
    data: { product: await adminService.getProduct(catalogIdSchema.parse(request.params.id)) },
    requestId: request.id,
  });
});

adminRouter.patch('/products/:id/restore', async (request, response) => {
  response.json({
    data: {
      product: await catalogService.updateProduct(
        catalogIdSchema.parse(request.params.id),
        {
          isActive: true,
        },
        auditContext(request, AdminAuditAction.PRODUCT_RESTORED),
      ),
    },
    requestId: request.id,
  });
});

adminRouter.get('/categories', async (request, response) => {
  response.json({
    data: await adminService.listCategories(adminCategoryListQuerySchema.parse(request.query)),
    requestId: request.id,
  });
});

adminRouter.patch('/categories/:id/restore', async (request, response) => {
  response.json({
    data: {
      category: await catalogService.updateCategory(
        catalogIdSchema.parse(request.params.id),
        {
          isActive: true,
        },
        auditContext(request, AdminAuditAction.CATEGORY_RESTORED),
      ),
    },
    requestId: request.id,
  });
});

adminRouter.get('/inventory', async (request, response) => {
  response.json({
    data: await adminService.listInventory(adminInventoryListQuerySchema.parse(request.query)),
    requestId: request.id,
  });
});

adminRouter.patch('/inventory/:productId', async (request, response) => {
  const input = inventoryUpdateSchema.parse(request.body);
  response.json({
    data: {
      product: await adminService.updateInventory(
        catalogIdSchema.parse(request.params.productId),
        input.totalQuantity,
        auditContext(request),
      ),
    },
    requestId: request.id,
  });
});

adminRouter.get('/orders', async (request, response) => {
  response.json({
    data: await adminService.listOrders(adminOrderListQuerySchema.parse(request.query)),
    requestId: request.id,
  });
});

adminRouter.get('/orders/:id', async (request, response) => {
  response.json({
    data: { order: await adminService.getOrder(catalogIdSchema.parse(request.params.id)) },
    requestId: request.id,
  });
});

adminRouter.patch('/orders/:id/status', async (request, response) => {
  response.json({
    data: {
      order: await adminService.updateOrderStatus(
        catalogIdSchema.parse(request.params.id),
        getAdministratorId(request.auth),
        orderStatusUpdateSchema.parse(request.body),
      ),
    },
    requestId: request.id,
  });
});

adminRouter.get('/users', async (request, response) => {
  response.json({
    data: await adminService.listUsers(adminUserListQuerySchema.parse(request.query)),
    requestId: request.id,
  });
});

adminRouter.get('/system', async (request, response) => {
  response.json({ data: await adminService.getSystemOverview(), requestId: request.id });
});
