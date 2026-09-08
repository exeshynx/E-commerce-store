import { expect, type APIRequestContext } from '@playwright/test';

interface ApiEnvelope<T> {
  data: T;
  requestId: string;
}

interface LoginData {
  accessToken: string;
}

export const apiLogin = async (
  request: APIRequestContext,
  credentials: { email: string; password: string },
) => {
  const response = await request.post('/api/v1/auth/login', { data: credentials });
  expect(response.ok(), await response.text()).toBeTruthy();
  return (await response.json()) as ApiEnvelope<LoginData>;
};

export const authorizedRequest = (
  request: APIRequestContext,
  accessToken: string,
  path: string,
  options: { data?: unknown; method?: 'get' | 'patch' | 'post' } = {},
) => {
  const method = options.method ?? 'get';
  return request[method](path, {
    ...(options.data === undefined ? {} : { data: options.data }),
    headers: { Authorization: `Bearer ${accessToken}` },
  });
};

export const expectData = async <T>(response: Awaited<ReturnType<typeof authorizedRequest>>) => {
  expect(response.ok(), await response.text()).toBeTruthy();
  return ((await response.json()) as ApiEnvelope<T>).data;
};
