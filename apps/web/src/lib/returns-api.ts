import type {
  ApiSuccess,
  ReturnCreateRequest,
  ReturnDetailData,
  ReturnListData,
} from '@aurelia/contracts';
import { apiClient } from './api-client';

export const returnQueryKeys = {
  all: ['returns'] as const,
  detail: (id: string) => ['returns', 'detail', id] as const,
  list: (page: number, pageSize: number) => ['returns', 'list', page, pageSize] as const,
};

export const returnsApi = {
  create: async (input: ReturnCreateRequest) => {
    const response = await apiClient.post<ApiSuccess<ReturnDetailData>>('/returns', input);
    return response.data.data;
  },
  get: async (id: string) => {
    const response = await apiClient.get<ApiSuccess<ReturnDetailData>>(
      `/returns/${encodeURIComponent(id)}`,
    );
    return response.data.data;
  },
  list: async (page: number, pageSize: number) => {
    const response = await apiClient.get<ApiSuccess<ReturnListData>>('/returns', {
      params: { page, pageSize },
    });
    return response.data.data;
  },
};
