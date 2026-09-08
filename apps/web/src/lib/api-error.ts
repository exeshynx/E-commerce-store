import type { ApiError } from '@veyora/contracts';
import axios from 'axios';

const isApiError = (value: unknown): value is ApiError => {
  if (!value || typeof value !== 'object' || !('error' in value)) return false;
  const error = value.error;
  if (!error || typeof error !== 'object' || !('message' in error)) return false;
  return typeof error.message === 'string';
};

export const getApiErrorMessage = (error: unknown) => {
  if (axios.isAxiosError<ApiError>(error)) {
    if (isApiError(error.response?.data)) return error.response.data.error.message;
    if (error.code === 'ERR_NETWORK') {
      return 'The API could not be reached. Confirm that the development server is running.';
    }
    return 'The server could not complete the request.';
  }
  return 'Something unexpected happened. Please try again.';
};
