import { Router } from 'express';
import { catalogService } from '../../core/catalog/catalog.service.js';
import {
  catalogIdSchema,
  categoryCreateSchema,
  categoryUpdateSchema,
  imageMetadataSchema,
  imageUpdateSchema,
  productCreateSchema,
  productUpdateSchema,
} from '../../core/catalog/catalog.schemas.js';
import {
  productImageStorage,
  productImageUpload,
} from '../../infrastructure/storage/product-image.storage.js';
import { AppError } from '../errors/app-error.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';

export const adminCatalogRouter = Router();
adminCatalogRouter.use(authenticate, authorize('ADMIN'));

const auditContext = (request: Express.Request) => {
  if (!request.auth) {
    throw new AppError(401, 'AUTHENTICATION_REQUIRED', 'Authentication is required.');
  }
  return { administratorId: request.auth.userId, requestId: request.id };
};

adminCatalogRouter.post('/categories', async (request, response) => {
  response.status(201).json({
    data: {
      category: await catalogService.createCategory(
        categoryCreateSchema.parse(request.body),
        auditContext(request),
      ),
    },
    requestId: request.id,
  });
});

adminCatalogRouter.patch('/categories/:id', async (request, response) => {
  response.json({
    data: {
      category: await catalogService.updateCategory(
        catalogIdSchema.parse(request.params.id),
        categoryUpdateSchema.parse(request.body),
        auditContext(request),
      ),
    },
    requestId: request.id,
  });
});

adminCatalogRouter.delete('/categories/:id', async (request, response) => {
  await catalogService.archiveCategory(
    catalogIdSchema.parse(request.params.id),
    auditContext(request),
  );
  response.status(204).send();
});

adminCatalogRouter.post('/products', async (request, response) => {
  response.status(201).json({
    data: {
      product: await catalogService.createProduct(
        productCreateSchema.parse(request.body),
        auditContext(request),
      ),
    },
    requestId: request.id,
  });
});

adminCatalogRouter.patch('/products/:id', async (request, response) => {
  response.json({
    data: {
      product: await catalogService.updateProduct(
        catalogIdSchema.parse(request.params.id),
        productUpdateSchema.parse(request.body),
        auditContext(request),
      ),
    },
    requestId: request.id,
  });
});

adminCatalogRouter.delete('/products/:id', async (request, response) => {
  await catalogService.archiveProduct(
    catalogIdSchema.parse(request.params.id),
    auditContext(request),
  );
  response.status(204).send();
});

adminCatalogRouter.post('/products/:id/images', productImageUpload, async (request, response) => {
  if (!request.file) {
    throw new AppError(422, 'IMAGE_REQUIRED', 'Select an image to upload.');
  }

  const productId = catalogIdSchema.parse(request.params.id);
  const publicPath = productImageStorage.publicPath(productId, request.file.filename);
  try {
    await productImageStorage.validate(publicPath);
    const metadata = imageMetadataSchema.parse(request.body);
    const image = await catalogService.addProductImage(
      productId,
      publicPath,
      metadata.altText,
      auditContext(request),
    );
    response.status(201).json({
      data: { image },
      requestId: request.id,
    });
  } catch (error) {
    await productImageStorage.remove(publicPath);
    throw error;
  }
});

adminCatalogRouter.patch('/products/:productId/images/:imageId', async (request, response) => {
  response.json({
    data: {
      image: await catalogService.updateProductImage(
        catalogIdSchema.parse(request.params.productId),
        catalogIdSchema.parse(request.params.imageId),
        imageUpdateSchema.parse(request.body),
        auditContext(request),
      ),
    },
    requestId: request.id,
  });
});

adminCatalogRouter.delete('/products/:productId/images/:imageId', async (request, response) => {
  const path = await catalogService.removeProductImage(
    catalogIdSchema.parse(request.params.productId),
    catalogIdSchema.parse(request.params.imageId),
    auditContext(request),
  );
  await productImageStorage.remove(path);
  response.status(204).send();
});
