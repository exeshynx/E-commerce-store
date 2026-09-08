import { z } from 'zod';

export const addCartItemSchema = z.object({
  productId: z.uuid(),
  quantity: z.coerce.number().int().min(1).max(999).default(1),
});

export const updateCartItemSchema = z.object({
  quantity: z.coerce.number().int().min(1).max(999),
});

export const addWishlistItemSchema = z.object({
  productId: z.uuid(),
});

export const commerceIdSchema = z.uuid();

export type AddCartItemInput = z.infer<typeof addCartItemSchema>;
export type UpdateCartItemInput = z.infer<typeof updateCartItemSchema>;
