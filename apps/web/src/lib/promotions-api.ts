import type { ApiSuccess, CouponPreview } from '@aurelia/contracts';
import { apiClient } from './api-client';

export const promotionsApi = {
  validateCoupon: async (code: string) => {
    const response = await apiClient.post<ApiSuccess<{ coupon: CouponPreview }>>(
      '/coupons/validate',
      { code },
    );
    return response.data.data.coupon;
  },
};
