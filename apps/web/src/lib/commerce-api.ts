import type {
  AddCartItemRequest,
  ApiSuccess,
  CartData,
  UpdateCartItemRequest,
  WishlistData,
} from '@veyora/contracts';
import { apiClient } from './api-client';

export const commerceQueryKeys = {
  cart: ['commerce', 'cart'] as const,
  wishlist: ['commerce', 'wishlist'] as const,
};

export const commerceApi = {
  addCartItem: async (input: AddCartItemRequest) => {
    const response = await apiClient.post<ApiSuccess<CartData>>('/cart/items', input);
    return response.data.data;
  },
  addWishlistItem: async (productId: string) => {
    const response = await apiClient.post<ApiSuccess<WishlistData>>('/wishlist/items', {
      productId,
    });
    return response.data.data;
  },
  clearCart: async () => {
    await apiClient.delete('/cart');
  },
  getCart: async () => {
    const response = await apiClient.get<ApiSuccess<CartData>>('/cart');
    return response.data.data;
  },
  getWishlist: async () => {
    const response = await apiClient.get<ApiSuccess<WishlistData>>('/wishlist');
    return response.data.data;
  },
  removeCartItem: async (itemId: string) => {
    await apiClient.delete(`/cart/items/${encodeURIComponent(itemId)}`);
  },
  removeWishlistItem: async (productId: string) => {
    await apiClient.delete(`/wishlist/items/${encodeURIComponent(productId)}`);
  },
  updateCartItem: async (itemId: string, input: UpdateCartItemRequest) => {
    const response = await apiClient.patch<ApiSuccess<CartData>>(`/cart/items/${itemId}`, input);
    return response.data.data;
  },
};
