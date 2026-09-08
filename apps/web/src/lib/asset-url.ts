import { apiBaseUrl } from './api-client';

export const resolveAssetUrl = (url: string) => {
  if (/^https?:\/\//i.test(url)) return url;
  if (!/^https?:\/\//i.test(apiBaseUrl)) return url;

  return new URL(url, new URL(apiBaseUrl).origin).toString();
};
