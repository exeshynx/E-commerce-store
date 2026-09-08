import { Router } from 'express';
import { commerceService } from '../../core/commerce/commerce.service.js';
import {
  addCartItemSchema,
  addWishlistItemSchema,
  commerceIdSchema,
  updateCartItemSchema,
} from '../../core/commerce/commerce.schemas.js';
import { AppError } from '../errors/app-error.js';
import { authenticate } from '../middleware/authenticate.js';
import { resolveShopper } from '../middleware/resolve-shopper.js';

export const commerceRouter = Router();

const getUserId = (auth: Express.Request['auth']) => {
  if (!auth) throw new AppError(401, 'AUTHENTICATION_REQUIRED', 'Authentication is required.');
  return auth.userId;
};

const getShopperId = (shopper: Express.Request['shopper']) => {
  if (!shopper) throw new AppError(400, 'SHOPPER_IDENTITY_REQUIRED', 'A shopper is required.');
  return shopper.userId;
};

commerceRouter.get('/cart', resolveShopper, async (request, response) => {
  response.json({
    data: { cart: await commerceService.getCart(getShopperId(request.shopper)) },
    requestId: request.id,
  });
});

commerceRouter.post('/cart/items', resolveShopper, async (request, response) => {
  response.status(201).json({
    data: {
      cart: await commerceService.addCartItem(
        getShopperId(request.shopper),
        addCartItemSchema.parse(request.body),
      ),
    },
    requestId: request.id,
  });
});

commerceRouter.patch('/cart/items/:id', resolveShopper, async (request, response) => {
  response.json({
    data: {
      cart: await commerceService.updateCartItem(
        getShopperId(request.shopper),
        commerceIdSchema.parse(request.params.id),
        updateCartItemSchema.parse(request.body),
      ),
    },
    requestId: request.id,
  });
});

commerceRouter.delete('/cart/items/:id', resolveShopper, async (request, response) => {
  await commerceService.removeCartItem(
    getShopperId(request.shopper),
    commerceIdSchema.parse(request.params.id),
  );
  response.status(204).send();
});

commerceRouter.delete('/cart', resolveShopper, async (request, response) => {
  await commerceService.clearCart(getShopperId(request.shopper));
  response.status(204).send();
});

commerceRouter.get('/wishlist', authenticate, async (request, response) => {
  response.json({
    data: { wishlist: await commerceService.getWishlist(getUserId(request.auth)) },
    requestId: request.id,
  });
});

commerceRouter.post('/wishlist/items', authenticate, async (request, response) => {
  const input = addWishlistItemSchema.parse(request.body);
  const result = await commerceService.addWishlistItem(getUserId(request.auth), input.productId);
  response.status(result.created ? 201 : 200).json({
    data: { wishlist: result.wishlist },
    requestId: request.id,
  });
});

commerceRouter.delete('/wishlist/items/:productId', authenticate, async (request, response) => {
  await commerceService.removeWishlistItem(
    getUserId(request.auth),
    commerceIdSchema.parse(request.params.productId),
  );
  response.status(204).send();
});
