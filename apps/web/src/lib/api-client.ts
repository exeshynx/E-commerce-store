import axios from 'axios';
import type { ApiSuccess, AuthSessionData } from '@aurelia/contracts';
import { useAuthStore } from '../stores/auth-store';

const configuredApiUrl: unknown = import.meta.env.VITE_API_URL;
export const apiBaseUrl =
  typeof configuredApiUrl === 'string' && configuredApiUrl.length > 0
    ? configuredApiUrl
    : '/api/v1';

export const apiClient = axios.create({
  baseURL: apiBaseUrl,
  headers: {
    Accept: 'application/json',
  },
  timeout: 10_000,
  withCredentials: true,
});

const guestTokenKey = 'aurelia.guest-token';
let cachedGuestToken: string | null = null;
const getGuestToken = () => {
  if (cachedGuestToken) return cachedGuestToken;
  try {
    const existing = window.localStorage.getItem(guestTokenKey);
    if (existing) {
      cachedGuestToken = existing;
      return existing;
    }
    cachedGuestToken = crypto.randomUUID();
    window.localStorage.setItem(guestTokenKey, cachedGuestToken);
    return cachedGuestToken;
  } catch {
    cachedGuestToken = crypto.randomUUID();
    return cachedGuestToken;
  }
};

apiClient.interceptors.request.use((config) => {
  const accessToken = useAuthStore.getState().accessToken;
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  config.headers['X-Guest-Token'] = getGuestToken();
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    if (!axios.isAxiosError(error) || error.response?.status !== 401 || !error.config) {
      return Promise.reject(error instanceof Error ? error : new Error('Request failed'));
    }

    const originalRequest = error.config as typeof error.config & { _authRetry?: boolean };
    if (originalRequest._authRetry || !originalRequest.headers.Authorization) {
      return Promise.reject(error);
    }

    originalRequest._authRetry = true;
    try {
      const response = await axios.post<ApiSuccess<AuthSessionData>>(
        `${apiBaseUrl}/auth/refresh`,
        undefined,
        { withCredentials: true },
      );
      useAuthStore.getState().setSession(response.data.data);
      originalRequest.headers.Authorization = `Bearer ${response.data.data.accessToken}`;
      return apiClient(originalRequest);
    } catch (refreshError) {
      useAuthStore.getState().clearSession();
      return Promise.reject(refreshError instanceof Error ? refreshError : error);
    }
  },
);
