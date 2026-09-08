import type {
  ApiSuccess,
  AuthSessionData,
  CurrentUserData,
  LoginRequest,
  RegisterRequest,
} from '@veyora/contracts';
import { apiClient } from './api-client';

export const authApi = {
  getCurrentUser: async () => {
    const response = await apiClient.get<ApiSuccess<CurrentUserData>>('/auth/me');
    return response.data.data;
  },
  login: async (input: LoginRequest) => {
    const response = await apiClient.post<ApiSuccess<AuthSessionData>>('/auth/login', input);
    return response.data.data;
  },
  logout: async () => {
    await apiClient.post('/auth/logout');
  },
  refresh: async () => {
    const response = await apiClient.post<ApiSuccess<AuthSessionData>>('/auth/refresh');
    return response.data.data;
  },
  register: async (input: RegisterRequest) => {
    const response = await apiClient.post<ApiSuccess<AuthSessionData>>('/auth/register', input);
    return response.data.data;
  },
};
