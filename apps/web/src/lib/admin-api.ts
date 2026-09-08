import type {
  AdminCategoryListData,
  AdminCategoryWriteRequest,
  AdminDashboardData,
  AdminInventoryListData,
  AdminInventoryUpdateRequest,
  AdminOrderDetailData,
  AdminOrderListData,
  AdminOrderStatusUpdateRequest,
  AdminPaymentDetailData,
  AdminPaymentListData,
  AdminPaymentRefundRequest,
  AdminPaymentStatusUpdateRequest,
  AdminProductDetailData,
  AdminProductListData,
  AdminProductWriteRequest,
  AdminSystemOverviewData,
  AdminUserListData,
  AdminAuditAction,
  AdminAuditEntityType,
  AdminAuditListData,
  AdminShipmentCreateRequest,
  AdminShipmentDetailData,
  AdminShipmentEventRequest,
  AdminShipmentListData,
  AdminShipmentUpdateRequest,
  ApiSuccess,
  CatalogCategory,
  CatalogProduct,
  OrderStatus,
  OrderPaymentHistoryData,
  PaymentAttemptData,
  PaymentRefundData,
  PaymentProvider,
  PaymentStatus,
  ProductImage,
  UserRole,
  UserStatus,
  ShipmentStatus,
  ShipmentData,
  AdminReturnUpdateRequest,
  AdminSupportTicketUpdateRequest,
  ReturnDetailData,
  ReturnListData,
  ReturnStatus,
  SupportMessageRequest,
  SupportTicketDetailData,
  SupportTicketListData,
  SupportTicketPriority,
  SupportTicketStatus,
  AdminCouponListData,
  AdminReviewListData,
  AdminReviewUpdateRequest,
  Coupon,
  CouponWriteRequest,
} from '@veyora/contracts';
import { apiClient } from './api-client';

export type ActivityFilter = 'all' | 'active' | 'archived';

export type Campaign = {
  audience: 'ALL_REGISTERED' | 'CUSTOMERS_WITH_CARTS' | 'PURCHASERS';
  createdAt: string;
  id: string;
  message: string;
  name: string;
  queuedAt: string | null;
  queuedMessages: number;
  recipientCount: number;
  status: 'DRAFT' | 'QUEUED';
  subject: string;
};

export type CampaignWriteRequest = Pick<Campaign, 'audience' | 'message' | 'name' | 'subject'>;

export type CommerceActivityData = {
  carts: Array<{
    id: string;
    updatedAt: string;
    user: { email: string; firstName: string; id: string; isGuest: boolean; lastName: string };
    items: Array<{
      id: string;
      product: { id: string; name: string; sku: string; slug: string };
      quantity: number;
      updatedAt: string;
    }>;
  }>;
  purchases: Array<{
    createdAt: string;
    currency: string;
    id: string;
    items: Array<{ productId: string; productName: string; quantity: number; sku: string }>;
    orderNumber: string;
    shippingAddress: { email: string; fullName: string } | null;
    total: string;
    user: { email: string; firstName: string; id: string; isGuest: boolean; lastName: string };
  }>;
};

export type AdminProductListParameters = {
  categoryId?: string;
  page: number;
  pageSize: number;
  q?: string;
  sort?: 'created_desc' | 'created_asc' | 'name_asc' | 'name_desc' | 'price_asc' | 'price_desc';
  status?: ActivityFilter;
};

export type AdminCategoryListParameters = {
  page: number;
  pageSize: number;
  q?: string;
  sort?: 'name_asc' | 'name_desc' | 'created_desc' | 'created_asc';
  status?: ActivityFilter;
};

export type AdminInventoryListParameters = {
  page: number;
  pageSize: number;
  q?: string;
  stock?: 'all' | 'in_stock' | 'low_stock' | 'out_of_stock';
};

export type AdminOrderListParameters = {
  page: number;
  pageSize: number;
  q?: string;
  sort?: 'created_desc' | 'created_asc' | 'total_desc' | 'total_asc';
  status?: OrderStatus;
};

export type AdminUserListParameters = {
  page: number;
  pageSize: number;
  q?: string;
  role?: UserRole;
  sort?: 'created_desc' | 'created_asc' | 'name_asc' | 'name_desc';
  status?: UserStatus;
};

export type AdminPaymentListParameters = {
  page: number;
  pageSize: number;
  provider?: PaymentProvider;
  q?: string;
  status?: PaymentStatus;
};

export type AdminShipmentListParameters = {
  page: number;
  pageSize: number;
  q?: string;
  status?: ShipmentStatus;
};

export type AdminAuditListParameters = {
  action?: AdminAuditAction;
  entityType?: AdminAuditEntityType;
  page: number;
  pageSize: number;
  q?: string;
};

export type AdminReturnListParameters = {
  page: number;
  pageSize: number;
  q?: string;
  status?: ReturnStatus;
};

export type AdminSupportListParameters = {
  assignedToId?: string;
  page: number;
  pageSize: number;
  priority?: SupportTicketPriority;
  q?: string;
  status?: SupportTicketStatus;
};

export type AdminReviewListParameters = {
  page: number;
  pageSize: number;
  q?: string;
  status?: 'PENDING' | 'APPROVED' | 'REJECTED';
  visibility?: 'all' | 'visible' | 'deleted';
};

export type AdminCouponListParameters = {
  page: number;
  pageSize: number;
  q?: string;
  status?: 'all' | 'enabled' | 'disabled' | 'active' | 'expired' | 'scheduled';
};

export const adminQueryKeys = {
  all: ['admin'] as const,
  audit: (parameters: AdminAuditListParameters) => ['admin', 'audit', parameters] as const,
  categories: (parameters: AdminCategoryListParameters) =>
    ['admin', 'categories', parameters] as const,
  dashboard: ['admin', 'dashboard'] as const,
  inventory: (parameters: AdminInventoryListParameters) =>
    ['admin', 'inventory', parameters] as const,
  order: (id: string) => ['admin', 'orders', 'detail', id] as const,
  orders: (parameters: AdminOrderListParameters) => ['admin', 'orders', parameters] as const,
  orderPayments: (id: string) => ['admin', 'orders', 'detail', id, 'payments'] as const,
  payments: (parameters: AdminPaymentListParameters) => ['admin', 'payments', parameters] as const,
  payment: (id: string) => ['admin', 'payments', 'detail', id] as const,
  product: (id: string) => ['admin', 'products', 'detail', id] as const,
  products: (parameters: AdminProductListParameters) => ['admin', 'products', parameters] as const,
  system: ['admin', 'system'] as const,
  shipment: (id: string) => ['admin', 'shipments', 'detail', id] as const,
  shipments: (parameters: AdminShipmentListParameters) =>
    ['admin', 'shipments', parameters] as const,
  users: (parameters: AdminUserListParameters) => ['admin', 'users', parameters] as const,
  returnRequest: (id: string) => ['admin', 'returns', 'detail', id] as const,
  returns: (parameters: AdminReturnListParameters) => ['admin', 'returns', parameters] as const,
  supportTicket: (id: string) => ['admin', 'support', 'detail', id] as const,
  supportTickets: (parameters: AdminSupportListParameters) =>
    ['admin', 'support', parameters] as const,
  reviews: (parameters: AdminReviewListParameters) => ['admin', 'reviews', parameters] as const,
  coupons: (parameters: AdminCouponListParameters) => ['admin', 'coupons', parameters] as const,
  campaigns: ['admin', 'campaigns'] as const,
  commerceActivity: ['admin', 'commerce-activity'] as const,
};

export const adminApi = {
  createCampaign: async (input: CampaignWriteRequest) => {
    const response = await apiClient.post<ApiSuccess<{ campaign: Campaign }>>(
      '/admin/campaigns',
      input,
    );
    return response.data.data.campaign;
  },
  getCommerceActivity: async () => {
    const response = await apiClient.get<ApiSuccess<CommerceActivityData>>(
      '/admin/commerce-activity',
    );
    return response.data.data;
  },
  listCampaigns: async () => {
    const response = await apiClient.get<ApiSuccess<{ items: Campaign[] }>>('/admin/campaigns');
    return response.data.data;
  },
  queueCampaign: async (id: string) => {
    const response = await apiClient.post<ApiSuccess<{ campaign: Campaign }>>(
      `/admin/campaigns/${encodeURIComponent(id)}/queue`,
    );
    return response.data.data.campaign;
  },
  createCoupon: async (input: CouponWriteRequest) => {
    const response = await apiClient.post<ApiSuccess<{ coupon: Coupon }>>('/admin/coupons', input);
    return response.data.data.coupon;
  },
  listCoupons: async (parameters: AdminCouponListParameters) => {
    const response = await apiClient.get<ApiSuccess<AdminCouponListData>>('/admin/coupons', {
      params: parameters,
    });
    return response.data.data;
  },
  listReviews: async (parameters: AdminReviewListParameters) => {
    const response = await apiClient.get<ApiSuccess<AdminReviewListData>>('/admin/reviews', {
      params: parameters,
    });
    return response.data.data;
  },
  moderateReview: async (id: string, input: AdminReviewUpdateRequest) => {
    const response = await apiClient.patch<ApiSuccess<{ review: unknown }>>(
      `/admin/reviews/${encodeURIComponent(id)}`,
      input,
    );
    return response.data.data.review;
  },
  setProductFeatured: async (id: string, isFeatured: boolean) => {
    const response = await apiClient.patch<ApiSuccess<{ product: CatalogProduct }>>(
      `/admin/products/${encodeURIComponent(id)}/featured`,
      { isFeatured },
    );
    return response.data.data.product;
  },
  updateCoupon: async (id: string, input: Partial<CouponWriteRequest>) => {
    const response = await apiClient.patch<ApiSuccess<{ coupon: Coupon }>>(
      `/admin/coupons/${encodeURIComponent(id)}`,
      input,
    );
    return response.data.data.coupon;
  },
  getReturn: async (id: string) => {
    const response = await apiClient.get<ApiSuccess<ReturnDetailData>>(
      `/admin/returns/${encodeURIComponent(id)}`,
    );
    return response.data.data;
  },
  getSupportTicket: async (id: string) => {
    const response = await apiClient.get<ApiSuccess<SupportTicketDetailData>>(
      `/admin/tickets/${encodeURIComponent(id)}`,
    );
    return response.data.data;
  },
  listReturns: async (parameters: AdminReturnListParameters) => {
    const response = await apiClient.get<ApiSuccess<ReturnListData>>('/admin/returns', {
      params: parameters,
    });
    return response.data.data;
  },
  listSupportTickets: async (parameters: AdminSupportListParameters) => {
    const response = await apiClient.get<ApiSuccess<SupportTicketListData>>('/admin/tickets', {
      params: parameters,
    });
    return response.data.data;
  },
  replySupportTicket: async (id: string, input: SupportMessageRequest) => {
    const response = await apiClient.post<ApiSuccess<SupportTicketDetailData>>(
      `/admin/tickets/${encodeURIComponent(id)}/messages`,
      input,
    );
    return response.data.data;
  },
  updateReturn: async (id: string, input: AdminReturnUpdateRequest) => {
    const response = await apiClient.patch<ApiSuccess<ReturnDetailData>>(
      `/admin/returns/${encodeURIComponent(id)}`,
      input,
    );
    return response.data.data;
  },
  updateSupportTicket: async (id: string, input: AdminSupportTicketUpdateRequest) => {
    const response = await apiClient.patch<ApiSuccess<SupportTicketDetailData>>(
      `/admin/tickets/${encodeURIComponent(id)}`,
      input,
    );
    return response.data.data;
  },
  addShipmentEvent: async (id: string, input: AdminShipmentEventRequest) => {
    const response = await apiClient.post<ApiSuccess<ShipmentData>>(
      `/admin/shipments/${encodeURIComponent(id)}/events`,
      input,
    );
    return response.data.data;
  },
  archiveCategory: async (id: string) => {
    await apiClient.delete(`/admin/categories/${encodeURIComponent(id)}`);
  },
  archiveProduct: async (id: string) => {
    await apiClient.delete(`/admin/products/${encodeURIComponent(id)}`);
  },
  createCategory: async (input: AdminCategoryWriteRequest) => {
    const response = await apiClient.post<ApiSuccess<{ category: CatalogCategory }>>(
      '/admin/categories',
      input,
    );
    return response.data.data.category;
  },
  createProduct: async (input: AdminProductWriteRequest) => {
    const response = await apiClient.post<ApiSuccess<{ product: CatalogProduct }>>(
      '/admin/products',
      input,
    );
    return response.data.data.product;
  },
  createShipment: async (orderId: string, input: AdminShipmentCreateRequest) => {
    const response = await apiClient.post<ApiSuccess<ShipmentData>>(
      `/admin/orders/${encodeURIComponent(orderId)}/shipments`,
      input,
    );
    return response.data.data;
  },
  deleteProductImage: async (productId: string, imageId: string) => {
    await apiClient.delete(
      `/admin/products/${encodeURIComponent(productId)}/images/${encodeURIComponent(imageId)}`,
    );
  },
  getDashboard: async () => {
    const response = await apiClient.get<ApiSuccess<AdminDashboardData>>('/admin/dashboard');
    return response.data.data;
  },
  getOrder: async (id: string) => {
    const response = await apiClient.get<ApiSuccess<AdminOrderDetailData>>(
      `/admin/orders/${encodeURIComponent(id)}`,
    );
    return response.data.data;
  },
  getOrderPayments: async (id: string) => {
    const response = await apiClient.get<ApiSuccess<OrderPaymentHistoryData>>(
      `/admin/orders/${encodeURIComponent(id)}/payments`,
    );
    return response.data.data;
  },
  getPayment: async (id: string) => {
    const response = await apiClient.get<ApiSuccess<AdminPaymentDetailData>>(
      `/admin/payments/${encodeURIComponent(id)}`,
    );
    return response.data.data;
  },
  getProduct: async (id: string) => {
    const response = await apiClient.get<ApiSuccess<AdminProductDetailData>>(
      `/admin/products/${encodeURIComponent(id)}`,
    );
    return response.data.data;
  },
  getSystemOverview: async () => {
    const response = await apiClient.get<ApiSuccess<AdminSystemOverviewData>>('/admin/system');
    return response.data.data;
  },
  getShipment: async (id: string) => {
    const response = await apiClient.get<ApiSuccess<AdminShipmentDetailData>>(
      `/admin/shipments/${encodeURIComponent(id)}`,
    );
    return response.data.data;
  },
  listAudit: async (parameters: AdminAuditListParameters) => {
    const response = await apiClient.get<ApiSuccess<AdminAuditListData>>('/admin/audit', {
      params: parameters,
    });
    return response.data.data;
  },
  listCategories: async (parameters: AdminCategoryListParameters) => {
    const response = await apiClient.get<ApiSuccess<AdminCategoryListData>>('/admin/categories', {
      params: parameters,
    });
    return response.data.data;
  },
  listInventory: async (parameters: AdminInventoryListParameters) => {
    const response = await apiClient.get<ApiSuccess<AdminInventoryListData>>('/admin/inventory', {
      params: parameters,
    });
    return response.data.data;
  },
  listOrders: async (parameters: AdminOrderListParameters) => {
    const response = await apiClient.get<ApiSuccess<AdminOrderListData>>('/admin/orders', {
      params: parameters,
    });
    return response.data.data;
  },
  listPayments: async (parameters: AdminPaymentListParameters) => {
    const response = await apiClient.get<ApiSuccess<AdminPaymentListData>>('/admin/payments', {
      params: parameters,
    });
    return response.data.data;
  },
  listShipments: async (parameters: AdminShipmentListParameters) => {
    const response = await apiClient.get<ApiSuccess<AdminShipmentListData>>('/admin/shipments', {
      params: parameters,
    });
    return response.data.data;
  },
  listProducts: async (parameters: AdminProductListParameters) => {
    const response = await apiClient.get<ApiSuccess<AdminProductListData>>('/admin/products', {
      params: parameters,
    });
    return response.data.data;
  },
  listUsers: async (parameters: AdminUserListParameters) => {
    const response = await apiClient.get<ApiSuccess<AdminUserListData>>('/admin/users', {
      params: parameters,
    });
    return response.data.data;
  },
  restoreCategory: async (id: string) => {
    const response = await apiClient.patch<ApiSuccess<{ category: CatalogCategory }>>(
      `/admin/categories/${encodeURIComponent(id)}/restore`,
    );
    return response.data.data.category;
  },
  restoreProduct: async (id: string) => {
    const response = await apiClient.patch<ApiSuccess<{ product: CatalogProduct }>>(
      `/admin/products/${encodeURIComponent(id)}/restore`,
    );
    return response.data.data.product;
  },
  updateCategory: async (id: string, input: Partial<AdminCategoryWriteRequest>) => {
    const response = await apiClient.patch<ApiSuccess<{ category: CatalogCategory }>>(
      `/admin/categories/${encodeURIComponent(id)}`,
      input,
    );
    return response.data.data.category;
  },
  updateInventory: async (productId: string, input: AdminInventoryUpdateRequest) => {
    await apiClient.patch(`/admin/inventory/${encodeURIComponent(productId)}`, input);
  },
  updateOrderStatus: async (id: string, input: AdminOrderStatusUpdateRequest) => {
    const response = await apiClient.patch<ApiSuccess<AdminOrderDetailData>>(
      `/admin/orders/${encodeURIComponent(id)}/status`,
      input,
    );
    return response.data.data;
  },
  initiateManualPayment: async (id: string) => {
    const response = await apiClient.post<ApiSuccess<PaymentAttemptData>>(
      `/admin/orders/${encodeURIComponent(id)}/payments/manual`,
    );
    return response.data.data;
  },
  updatePaymentStatus: async (id: string, input: AdminPaymentStatusUpdateRequest) => {
    const response = await apiClient.patch<ApiSuccess<PaymentAttemptData>>(
      `/admin/payments/${encodeURIComponent(id)}/status`,
      input,
    );
    return response.data.data;
  },
  refundPayment: async (id: string, input: AdminPaymentRefundRequest, idempotencyKey: string) => {
    const response = await apiClient.post<ApiSuccess<PaymentRefundData>>(
      `/admin/payments/${encodeURIComponent(id)}/refunds`,
      input,
      { headers: { 'Idempotency-Key': idempotencyKey } },
    );
    return response.data.data;
  },
  updateProduct: async (id: string, input: Partial<AdminProductWriteRequest>) => {
    const response = await apiClient.patch<ApiSuccess<{ product: CatalogProduct }>>(
      `/admin/products/${encodeURIComponent(id)}`,
      input,
    );
    return response.data.data.product;
  },
  updateShipment: async (id: string, input: AdminShipmentUpdateRequest) => {
    const response = await apiClient.patch<ApiSuccess<ShipmentData>>(
      `/admin/shipments/${encodeURIComponent(id)}`,
      input,
    );
    return response.data.data;
  },
  updateProductImage: async (
    productId: string,
    imageId: string,
    input: { altText?: string | null; position?: number },
  ) => {
    const response = await apiClient.patch<ApiSuccess<{ image: ProductImage }>>(
      `/admin/products/${encodeURIComponent(productId)}/images/${encodeURIComponent(imageId)}`,
      input,
    );
    return response.data.data.image;
  },
  uploadProductImage: async (productId: string, image: File, altText: string) => {
    const formData = new FormData();
    formData.append('image', image);
    if (altText.trim()) formData.append('altText', altText.trim());
    const response = await apiClient.post<ApiSuccess<{ image: ProductImage }>>(
      `/admin/products/${encodeURIComponent(productId)}/images`,
      formData,
    );
    return response.data.data.image;
  },
};
