import type {
  AccountSummaryData,
  AddressListData,
  AddressWriteRequest,
  ApiSuccess,
  AuthUser,
  CustomerAddress,
  ProfileUpdateRequest,
} from '@veyora/contracts';
import { apiClient } from './api-client';

export const accountQueryKeys = {
  addresses: ['account', 'addresses'] as const,
  summary: ['account', 'summary'] as const,
};

export const accountApi = {
  changePassword: async (input: { currentPassword: string; newPassword: string }) => {
    await apiClient.post('/account/change-password', input);
  },
  createAddress: async (input: AddressWriteRequest) => {
    const response = await apiClient.post<ApiSuccess<{ address: CustomerAddress }>>(
      '/addresses',
      input,
    );
    return response.data.data.address;
  },
  deleteAddress: async (id: string) => {
    await apiClient.delete(`/addresses/${encodeURIComponent(id)}`);
  },
  getSummary: async () => {
    const response = await apiClient.get<ApiSuccess<AccountSummaryData>>('/account/summary');
    return response.data.data;
  },
  listAddresses: async () => {
    const response = await apiClient.get<ApiSuccess<AddressListData>>('/addresses');
    return response.data.data;
  },
  updateAddress: async (id: string, input: Partial<AddressWriteRequest>) => {
    const response = await apiClient.patch<ApiSuccess<{ address: CustomerAddress }>>(
      `/addresses/${encodeURIComponent(id)}`,
      input,
    );
    return response.data.data.address;
  },
  updateProfile: async (input: ProfileUpdateRequest) => {
    const response = await apiClient.patch<ApiSuccess<{ user: AuthUser }>>(
      '/account/profile',
      input,
    );
    return response.data.data.user;
  },
};
