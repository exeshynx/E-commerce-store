import type {
  ApiSuccess,
  CategoryListData,
  ProductDetailData,
  ProductListData,
} from '@aurelia/contracts';
import { apiClient } from './api-client';

export type ProductListParameters = {
  category?: string;
  page?: number;
  pageSize?: number;
  q?: string;
};

export const catalogApi = {
  getCategories: async () => {
    const response = await apiClient.get<ApiSuccess<CategoryListData>>('/categories');
    return response.data.data;
  },
  getProduct: async (identifier: string) => {
    const response = await apiClient.get<ApiSuccess<ProductDetailData>>(
      `/products/${encodeURIComponent(identifier)}`,
    );
    return response.data.data;
  },
  getProducts: async (parameters: ProductListParameters) => {
    const response = await apiClient.get<ApiSuccess<ProductListData>>('/products', {
      params: parameters,
    });
    return response.data.data;
  },
};
