import { AdminAuditAction } from '@prisma/client';
import { Router } from 'express';
import { catalogIdSchema } from '../../core/catalog/catalog.schemas.js';
import { catalogService } from '../../core/catalog/catalog.service.js';
import { z } from 'zod';
import { AppError } from '../errors/app-error.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';

export const adminDiscoveryRouter = Router();
adminDiscoveryRouter.use(authenticate, authorize('ADMIN'));

adminDiscoveryRouter.patch('/products/:id/featured', async (request, response) => {
  if (!request.auth)
    throw new AppError(401, 'AUTHENTICATION_REQUIRED', 'Authentication is required.');
  const input = z.object({ isFeatured: z.boolean() }).parse(request.body);
  response.json({
    data: {
      product: await catalogService.updateProduct(catalogIdSchema.parse(request.params.id), input, {
        action: input.isFeatured
          ? AdminAuditAction.PRODUCT_FEATURED
          : AdminAuditAction.PRODUCT_UNFEATURED,
        administratorId: request.auth.userId,
        requestId: request.id,
      }),
    },
    requestId: request.id,
  });
});
