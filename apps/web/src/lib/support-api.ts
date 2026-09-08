import type {
  ApiSuccess,
  SupportMessageRequest,
  SupportTicketCreateRequest,
  SupportTicketDetailData,
  SupportTicketListData,
} from '@aurelia/contracts';
import { apiClient } from './api-client';

export const supportQueryKeys = {
  all: ['support-tickets'] as const,
  detail: (id: string) => ['support-tickets', 'detail', id] as const,
  list: (page: number, pageSize: number) => ['support-tickets', 'list', page, pageSize] as const,
};

export const supportApi = {
  create: async (input: SupportTicketCreateRequest) => {
    const response = await apiClient.post<ApiSuccess<SupportTicketDetailData>>('/tickets', input);
    return response.data.data;
  },
  get: async (id: string) => {
    const response = await apiClient.get<ApiSuccess<SupportTicketDetailData>>(
      `/tickets/${encodeURIComponent(id)}`,
    );
    return response.data.data;
  },
  list: async (page: number, pageSize: number) => {
    const response = await apiClient.get<ApiSuccess<SupportTicketListData>>('/tickets', {
      params: { page, pageSize },
    });
    return response.data.data;
  },
  reply: async (id: string, input: SupportMessageRequest) => {
    const response = await apiClient.post<ApiSuccess<SupportTicketDetailData>>(
      `/tickets/${encodeURIComponent(id)}/messages`,
      input,
    );
    return response.data.data;
  },
};
