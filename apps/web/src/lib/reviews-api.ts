import type {
  ApiSuccess,
  ProductReview,
  ProductReviewListData,
  ReviewWriteRequest,
} from '@veyora/contracts';
import { apiClient } from './api-client';

export const reviewQueryKeys = {
  product: (productId: string, page: number, sort: string) =>
    ['reviews', productId, page, sort] as const,
};

export const reviewsApi = {
  create: async (productId: string, input: ReviewWriteRequest) => {
    const response = await apiClient.post<ApiSuccess<{ review: ProductReview }>>(
      `/products/${encodeURIComponent(productId)}/reviews`,
      input,
    );
    return response.data.data.review;
  },
  delete: async (id: string) => {
    await apiClient.delete(`/reviews/${encodeURIComponent(id)}`);
  },
  list: async (productId: string, page: number, sort: string) => {
    const response = await apiClient.get<ApiSuccess<ProductReviewListData>>(
      `/products/${encodeURIComponent(productId)}/reviews`,
      { params: { page, pageSize: 8, sort } },
    );
    return response.data.data;
  },
  update: async (id: string, input: Partial<ReviewWriteRequest>) => {
    const response = await apiClient.patch<ApiSuccess<{ review: ProductReview }>>(
      `/reviews/${encodeURIComponent(id)}`,
      input,
    );
    return response.data.data.review;
  },
};
