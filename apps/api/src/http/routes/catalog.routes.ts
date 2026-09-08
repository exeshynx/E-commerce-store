import { Router } from 'express';
import { catalogService } from '../../core/catalog/catalog.service.js';
import {
  productIdentifierSchema,
  productListQuerySchema,
} from '../../core/catalog/catalog.schemas.js';

export const catalogRouter = Router();

catalogRouter.get('/categories', async (request, response) => {
  response.json({
    data: {
      items: await catalogService.listCategories(),
    },
    requestId: request.id,
  });
});

catalogRouter.get('/products', async (request, response) => {
  response.json({
    data: await catalogService.listProducts(productListQuerySchema.parse(request.query)),
    requestId: request.id,
  });
});

catalogRouter.get('/products/:identifier', async (request, response) => {
  response.json({
    data: {
      product: await catalogService.getProduct(
        productIdentifierSchema.parse(request.params.identifier),
      ),
    },
    requestId: request.id,
  });
});
