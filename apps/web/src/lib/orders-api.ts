import type {
  ApiSuccess,
  CheckoutData,
  CheckoutRequest,
  OrderDetailData,
  OrderListData,
  OrderPaymentHistoryData,
  PaymentAttemptData,
  ShipmentTrackingData,
} from '@aurelia/contracts';
import { apiClient } from './api-client';

export const orderQueryKeys = {
  all: ['orders'] as const,
  detail: (id: string) => ['orders', 'detail', id] as const,
  list: (page: number, pageSize: number) => ['orders', 'list', page, pageSize] as const,
  payments: (id: string) => ['orders', 'detail', id, 'payments'] as const,
  tracking: (id: string) => ['orders', 'detail', id, 'tracking'] as const,
};

export const ordersApi = {
  checkout: async (input: CheckoutRequest, idempotencyKey: string) => {
    const response = await apiClient.post<ApiSuccess<CheckoutData>>('/checkout', input, {
      headers: { 'Idempotency-Key': idempotencyKey },
    });
    return response.data.data;
  },
  getOrder: async (id: string) => {
    const response = await apiClient.get<ApiSuccess<OrderDetailData>>(
      `/orders/${encodeURIComponent(id)}`,
    );
    return response.data.data;
  },
  getPayments: async (id: string) => {
    const response = await apiClient.get<ApiSuccess<OrderPaymentHistoryData>>(
      `/orders/${encodeURIComponent(id)}/payments`,
    );
    return response.data.data;
  },
  getTracking: async (id: string) => {
    const response = await apiClient.get<ApiSuccess<ShipmentTrackingData>>(
      `/orders/${encodeURIComponent(id)}/shipments`,
    );
    return response.data.data;
  },
  initiateManualPayment: async (id: string) => {
    const response = await apiClient.post<ApiSuccess<PaymentAttemptData>>(
      `/orders/${encodeURIComponent(id)}/payments/manual`,
    );
    return response.data.data;
  },
  initiateSafepayPayment: async (id: string, idempotencyKey: string) => {
    const response = await apiClient.post<ApiSuccess<PaymentAttemptData>>(
      `/orders/${encodeURIComponent(id)}/payments/safepay`,
      undefined,
      { headers: { 'Idempotency-Key': idempotencyKey } },
    );
    return response.data.data;
  },
  listOrders: async (page: number, pageSize: number) => {
    const response = await apiClient.get<ApiSuccess<OrderListData>>('/orders', {
      params: { page, pageSize },
    });
    return response.data.data;
  },
};
