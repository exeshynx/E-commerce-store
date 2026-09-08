import type {
  ApiSuccess,
  RecommendationData,
  RecommendationType,
  SearchData,
  SearchSuggestion,
} from '@veyora/contracts';
import { apiClient } from './api-client';

export type SearchParameters = {
  availability?: 'all' | 'in_stock' | 'out_of_stock';
  category?: string;
  maximumPrice?: number;
  minimumPrice?: number;
  minimumRating?: number;
  page: number;
  pageSize: number;
  q?: string;
  sort?: 'relevance' | 'newest' | 'best_selling' | 'highest_rated' | 'price_low' | 'price_high';
};

export const discoveryQueryKeys = {
  recommendations: (type: RecommendationType, productId?: string) =>
    ['discovery', 'recommendations', type, productId] as const,
  search: (parameters: SearchParameters) => ['discovery', 'search', parameters] as const,
  suggestions: (q: string) => ['discovery', 'suggestions', q] as const,
};

export const discoveryApi = {
  autocomplete: async (q: string) => {
    const response = await apiClient.get<ApiSuccess<{ items: SearchSuggestion[] }>>(
      '/search/suggestions',
      { params: { q } },
    );
    return response.data.data;
  },
  getRecommendations: async (type: RecommendationType, productId?: string) => {
    const response = await apiClient.get<ApiSuccess<RecommendationData>>('/recommendations', {
      params: { ...(productId ? { productId } : {}), limit: 8, type },
    });
    return response.data.data;
  },
  recordView: async (productId: string) => {
    await apiClient.post(`/products/${encodeURIComponent(productId)}/view`);
  },
  search: async (parameters: SearchParameters) => {
    const response = await apiClient.get<ApiSuccess<SearchData>>('/search', {
      params: parameters,
    });
    return response.data.data;
  },
};
