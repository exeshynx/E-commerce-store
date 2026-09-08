export type ApiSuccess<T> = {
  data: T;
  requestId: string;
};

export type ApiError = {
  error: {
    code: string;
    errorId?: string;
    message: string;
    details?: unknown;
  };
  requestId: string;
};

export type HealthStatus = {
  service: 'aurelia-api';
  status: 'ok' | 'ready' | 'not_ready';
  timestamp: string;
  uptimeSeconds: number;
};

export type UserRole = 'ADMIN' | 'CUSTOMER';
export type UserStatus = 'ACTIVE' | 'DISABLED';

export type AuthUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  avatarUrl: string | null;
  avatarAltText: string | null;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
};

export type AuthSessionData = {
  accessToken: string;
  user: AuthUser;
};

export type CurrentUserData = {
  user: AuthUser;
};

export type LoginRequest = {
  email: string;
  password: string;
};

export type RegisterRequest = LoginRequest & {
  firstName: string;
  lastName: string;
};

export type CatalogCategory = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  isActive: boolean;
  productCount?: number;
  createdAt: string;
  updatedAt: string;
};

export type ProductImage = {
  id: string;
  url: string;
  altText: string | null;
  position: number;
  createdAt: string;
  updatedAt: string;
};

export type CatalogProduct = {
  id: string;
  name: string;
  slug: string;
  sku: string;
  description: string;
  price: string;
  currency: string;
  isActive: boolean;
  isFeatured: boolean;
  rating?: {
    average: string;
    count: number;
  };
  soldQuantity?: number;
  category: CatalogCategory;
  images: ProductImage[];
  inventory: {
    availableQuantity: number;
    inStock: boolean;
  };
  createdAt: string;
  updatedAt: string;
};

export type Pagination = {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
};

export type CategoryListData = {
  items: CatalogCategory[];
};

export type ProductListData = {
  items: CatalogProduct[];
  pagination: Pagination;
};

export type ProductDetailData = {
  product: CatalogProduct;
};

export type CommerceUnavailableReason =
  'PRODUCT_INACTIVE' | 'CATEGORY_INACTIVE' | 'OUT_OF_STOCK' | 'INSUFFICIENT_STOCK';

export type CommerceProduct = {
  id: string;
  name: string;
  slug: string;
  sku: string;
  price: string;
  currency: string;
  category: {
    id: string;
    name: string;
    slug: string;
  };
  images: Array<{
    id: string;
    url: string;
    altText: string | null;
    position: number;
  }>;
};

export type CartItem = {
  id: string;
  product: CommerceProduct;
  quantity: number;
  unitPrice: string;
  currency: string;
  lineSubtotal: string;
  isAvailable: boolean;
  unavailableReason: CommerceUnavailableReason | null;
  createdAt: string;
  updatedAt: string;
};

export type ShoppingCart = {
  id: string;
  currency: string | null;
  items: CartItem[];
  subtotal: string;
  totalQuantity: number;
  createdAt: string;
  updatedAt: string;
};

export type WishlistItem = {
  id: string;
  product: CommerceProduct;
  isAvailable: boolean;
  unavailableReason: CommerceUnavailableReason | null;
  createdAt: string;
  updatedAt: string;
};

export type Wishlist = {
  id: string;
  items: WishlistItem[];
  createdAt: string;
  updatedAt: string;
};

export type CartData = {
  cart: ShoppingCart;
};

export type WishlistData = {
  wishlist: Wishlist;
};

export type AddCartItemRequest = {
  productId: string;
  quantity: number;
};

export type UpdateCartItemRequest = {
  quantity: number;
};

export type OrderStatus =
  'PENDING' | 'AWAITING_PAYMENT' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';

export type PaymentProvider = 'MANUAL' | 'SAFEPAY' | 'STRIPE' | 'PAYPAL' | 'OTHER';
export type PaymentStatus =
  'PENDING' | 'PROCESSING' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED' | 'REFUNDED';
export type PaymentRefundStatus = 'PENDING' | 'PROCESSING' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED';
export type PaymentWebhookProcessingStatus =
  'RECEIVED' | 'PROCESSING' | 'PROCESSED' | 'FAILED' | 'IGNORED';
export type ShipmentStatus =
  'PACKING' | 'READY_TO_SHIP' | 'SHIPPED' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'RETURNED';
export type EmailNotificationType =
  | 'ORDER_CONFIRMATION'
  | 'PAYMENT_SUCCESS'
  | 'SHIPMENT_NOTIFICATION'
  | 'DELIVERY_CONFIRMATION'
  | 'RETURN_REQUESTED'
  | 'RETURN_APPROVED'
  | 'RETURN_REJECTED'
  | 'REFUND_COMPLETED'
  | 'SUPPORT_TICKET_CREATED'
  | 'SUPPORT_ADMIN_REPLY'
  | 'SUPPORT_TICKET_RESOLVED';
export type EmailQueueStatus = 'PENDING' | 'PROCESSING' | 'SENT' | 'FAILED' | 'DEAD_LETTER';

export type ShippingAddressInput = {
  fullName: string;
  phone: string;
  email: string;
  country: string;
  province: string;
  city: string;
  postalCode: string;
  address: string;
};

export type ShippingAddressSnapshot = ShippingAddressInput & {
  createdAt: string;
};

export type OrderItemSnapshot = {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  unitPrice: string;
  currency: string;
  quantity: number;
  lineSubtotal: string;
  createdAt: string;
};

export type CustomerOrder = {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  currency: string;
  subtotal: string;
  discountAmount: string;
  total: string;
  coupon: {
    code: string;
    type: CouponType | null;
    value: string | null;
  } | null;
  items: OrderItemSnapshot[];
  shippingAddress: ShippingAddressSnapshot | null;
  createdAt: string;
  updatedAt: string;
};

export type CheckoutRequest = {
  addressId?: string;
  couponCode?: string;
  shippingAddress?: ShippingAddressInput;
};

export type CheckoutData = {
  order: CustomerOrder;
};

export type OrderListData = {
  items: CustomerOrder[];
  pagination: Pagination;
};

export type OrderDetailData = {
  order: CustomerOrder;
};

export type PaymentAttempt = {
  id: string;
  orderId: string;
  provider: PaymentProvider;
  status: PaymentStatus;
  providerPaymentId: string | null;
  amount: string;
  currency: string;
  failureReason: string | null;
  refunds?: PaymentRefund[];
  createdAt: string;
  updatedAt: string;
};

export type PaymentRefund = {
  id: string;
  paymentAttemptId: string;
  providerRefundId: string | null;
  status: PaymentRefundStatus;
  amount: string;
  currency: string;
  reason: string | null;
  failureReason: string | null;
  returnRequestId?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PaymentWebhookEvent = {
  id: string;
  externalEventId: string;
  eventType: string;
  processingStatus: PaymentWebhookProcessingStatus;
  processingAttempts: number;
  providerCreatedAt: string | null;
  processedAt: string | null;
  signatureVerified: boolean;
  lastError: string | null;
  createdAt: string;
};

export type OrderPaymentHistoryData = {
  items: PaymentAttempt[];
};

export type PaymentAttemptData = {
  checkoutUrl: string | null;
  payment: PaymentAttempt;
  orderStatus: OrderStatus;
};

export type PaymentRefundData = {
  refund: PaymentRefund;
};

export type ShipmentEvent = {
  id: string;
  previousStatus: ShipmentStatus | null;
  status: ShipmentStatus;
  location: string | null;
  message: string | null;
  occurredAt: string;
  createdAt: string;
  administrator?: Pick<AuthUser, 'id' | 'email' | 'firstName' | 'lastName'>;
};

export type Shipment = {
  id: string;
  orderId: string;
  courier: string;
  trackingNumber: string | null;
  status: ShipmentStatus;
  shippedAt: string | null;
  deliveredAt: string | null;
  events: ShipmentEvent[];
  order: {
    id: string;
    orderNumber: string;
    status: OrderStatus;
    user: Pick<AuthUser, 'id' | 'email' | 'firstName' | 'lastName'>;
  };
  createdAt: string;
  updatedAt: string;
};

export type EmailDeliverySummary = {
  id: string;
  notificationType: EmailNotificationType;
  status: EmailQueueStatus;
  attempts?: number;
  lastError?: string | null;
  createdAt: string;
  sentAt: string | null;
};

export type ShipmentTrackingData = {
  shipment: Shipment | null;
  notifications: EmailDeliverySummary[];
};

export type AdminShipmentListData = {
  items: Array<Omit<Shipment, 'events'>>;
  pagination: Pagination;
};

export type AdminShipmentDetailData = {
  shipment: Shipment;
  notifications: EmailDeliverySummary[];
};

export type ShipmentData = {
  shipment: Shipment;
};

export type ReturnReason =
  | 'DAMAGED'
  | 'DEFECTIVE'
  | 'WRONG_ITEM'
  | 'NOT_AS_DESCRIBED'
  | 'SIZE_OR_FIT'
  | 'CHANGED_MIND'
  | 'OTHER';
export type ReturnStatus =
  | 'REQUESTED'
  | 'APPROVED'
  | 'REJECTED'
  | 'ITEM_RECEIVED'
  | 'INSPECTED'
  | 'REFUND_PENDING'
  | 'REFUNDED'
  | 'CLOSED';
export type ReturnShipmentStatus =
  'AWAITING_SHIPMENT' | 'SHIPPED' | 'IN_TRANSIT' | 'DELIVERED' | 'RETURNED_TO_SENDER';

export type ReturnItem = {
  id: string;
  orderItemId: string;
  reason: ReturnReason;
  reasonDetails: string | null;
  quantity: number;
  productName: string;
  sku: string;
  unitPrice: string;
  currency: string;
  refundAmount: string;
  createdAt: string;
};

export type ReturnShipmentEvent = {
  id: string;
  previousStatus: ReturnShipmentStatus | null;
  status: ReturnShipmentStatus;
  location: string | null;
  message: string | null;
  occurredAt: string;
  createdAt: string;
  administrator?: Pick<AuthUser, 'id' | 'email' | 'firstName' | 'lastName'>;
};

export type ReturnShipment = {
  id: string;
  returnRequestId: string;
  courier: string | null;
  trackingNumber: string | null;
  status: ReturnShipmentStatus;
  shippedAt: string | null;
  deliveredAt: string | null;
  events: ReturnShipmentEvent[];
  createdAt: string;
  updatedAt: string;
};

export type ReturnRequest = {
  id: string;
  returnNumber: string;
  status: ReturnStatus;
  customerNote: string | null;
  rejectionReason: string | null;
  inspectionNotes: string | null;
  approvedAt: string | null;
  receivedAt: string | null;
  inspectedAt: string | null;
  refundedAt: string | null;
  closedAt: string | null;
  items: ReturnItem[];
  order: Pick<CustomerOrder, 'id' | 'orderNumber' | 'status'>;
  customer?: Pick<AuthUser, 'id' | 'email' | 'firstName' | 'lastName'>;
  shipment: ReturnShipment | null;
  refunds: PaymentRefund[];
  notifications: EmailDeliverySummary[];
  createdAt: string;
  updatedAt: string;
};

export type ReturnCreateRequest = {
  orderId: string;
  customerNote?: string;
  items: Array<{
    orderItemId: string;
    quantity: number;
    reason: ReturnReason;
    reasonDetails?: string;
  }>;
};

export type ReturnDetailData = { returnRequest: ReturnRequest };
export type ReturnRequestSummary = Pick<
  ReturnRequest,
  'id' | 'returnNumber' | 'status' | 'items' | 'order' | 'customer' | 'createdAt' | 'updatedAt'
> & {
  shipment: Pick<ReturnShipment, 'id' | 'status' | 'courier' | 'trackingNumber'> | null;
};
export type ReturnListData = { items: ReturnRequestSummary[]; pagination: Pagination };
export type AdminReturnUpdateRequest =
  | { action: 'APPROVE'; note?: string }
  | { action: 'REJECT'; reason: string }
  | { action: 'RECEIVE_ITEM'; note?: string }
  | { action: 'INSPECT'; inspectionNotes: string }
  | {
      action: 'INITIATE_REFUND';
      amount: string;
      idempotencyKey: string;
      paymentAttemptId: string;
      reason?: string;
    }
  | { action: 'CLOSE'; note?: string }
  | { action: 'UPDATE_SHIPMENT'; courier?: string | null; trackingNumber?: string | null }
  | {
      action: 'ADD_SHIPMENT_EVENT';
      status: ReturnShipmentStatus;
      location?: string;
      message?: string;
      occurredAt?: string;
    };

export type SupportTicketStatus =
  'OPEN' | 'IN_PROGRESS' | 'WAITING_CUSTOMER' | 'RESOLVED' | 'CLOSED';
export type SupportTicketPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
export type TicketAttachmentMetadata = {
  id?: string;
  fileName: string;
  mediaType: string;
  sizeBytes: number;
  checksum?: string | null;
  createdAt?: string;
};
export type SupportMessage = {
  id: string;
  body: string;
  authorRole: UserRole;
  author: Pick<AuthUser, 'id' | 'email' | 'firstName' | 'lastName'>;
  attachments: TicketAttachmentMetadata[];
  createdAt: string;
};
export type SupportTicketSummary = {
  id: string;
  ticketNumber: string;
  subject: string;
  status: SupportTicketStatus;
  priority: SupportTicketPriority;
  order: { id: string; orderNumber: string } | null;
  assignedTo: Pick<AuthUser, 'id' | 'email' | 'firstName' | 'lastName'> | null;
  customer?: Pick<AuthUser, 'id' | 'email' | 'firstName' | 'lastName'>;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
};
export type SupportTicket = Omit<SupportTicketSummary, 'messageCount' | 'order'> & {
  order: { id: string; orderNumber: string; status: OrderStatus } | null;
  messages: SupportMessage[];
  resolvedAt: string | null;
  closedAt: string | null;
};
export type SupportMessageRequest = {
  body: string;
  attachments?: Array<Omit<TicketAttachmentMetadata, 'id' | 'createdAt'>>;
};
export type SupportTicketCreateRequest = SupportMessageRequest & {
  subject: string;
  orderId?: string;
};
export type SupportTicketDetailData = { ticket: SupportTicket };
export type SupportTicketListData = { items: SupportTicketSummary[]; pagination: Pagination };
export type AdminSupportTicketUpdateRequest = {
  status?: SupportTicketStatus;
  priority?: SupportTicketPriority;
  assignedToId?: string | null;
};

export type AdminShipmentCreateRequest = {
  courier: string;
  trackingNumber?: string;
};

export type AdminShipmentUpdateRequest = {
  courier?: string;
  trackingNumber?: string | null;
};

export type AdminShipmentEventRequest = {
  status: ShipmentStatus;
  location?: string;
  message?: string;
  occurredAt?: string;
};

export type AdminAuditAction =
  | 'ADMIN_LOGIN'
  | 'PRODUCT_CREATED'
  | 'PRODUCT_UPDATED'
  | 'PRODUCT_ARCHIVED'
  | 'PRODUCT_RESTORED'
  | 'PRODUCT_IMAGE_ADDED'
  | 'PRODUCT_IMAGE_UPDATED'
  | 'PRODUCT_IMAGE_REMOVED'
  | 'CATEGORY_CREATED'
  | 'CATEGORY_UPDATED'
  | 'CATEGORY_ARCHIVED'
  | 'CATEGORY_RESTORED'
  | 'INVENTORY_UPDATED'
  | 'PAYMENT_REFUND_CREATED'
  | 'SHIPMENT_CREATED'
  | 'SHIPMENT_UPDATED'
  | 'SHIPMENT_STATUS_CHANGED'
  | 'RETURN_APPROVED'
  | 'RETURN_REJECTED'
  | 'RETURN_ITEM_RECEIVED'
  | 'RETURN_INSPECTED'
  | 'RETURN_REFUND_INITIATED'
  | 'RETURN_CLOSED'
  | 'RETURN_SHIPMENT_UPDATED'
  | 'RETURN_SHIPMENT_STATUS_CHANGED'
  | 'SUPPORT_TICKET_REPLIED'
  | 'SUPPORT_TICKET_ASSIGNED'
  | 'SUPPORT_TICKET_PRIORITY_CHANGED'
  | 'SUPPORT_TICKET_STATUS_CHANGED'
  | 'REVIEW_APPROVED'
  | 'REVIEW_REJECTED'
  | 'REVIEW_DELETED'
  | 'REVIEW_RESTORED'
  | 'COUPON_CREATED'
  | 'COUPON_UPDATED'
  | 'COUPON_ENABLED'
  | 'COUPON_DISABLED'
  | 'PRODUCT_FEATURED'
  | 'PRODUCT_UNFEATURED';

export type AdminAuditEntityType =
  | 'USER'
  | 'PRODUCT'
  | 'CATEGORY'
  | 'INVENTORY'
  | 'PAYMENT_REFUND'
  | 'SHIPMENT'
  | 'RETURN_REQUEST'
  | 'RETURN_SHIPMENT'
  | 'SUPPORT_TICKET'
  | 'REVIEW'
  | 'COUPON';

export type AdminAuditEntry = {
  id: string;
  action: AdminAuditAction;
  entityType: AdminAuditEntityType;
  entityId: string;
  requestId: string | null;
  metadata: unknown;
  administrator: Pick<AuthUser, 'id' | 'email' | 'firstName' | 'lastName'>;
  createdAt: string;
};

export type AdminAuditListData = {
  items: AdminAuditEntry[];
  pagination: Pagination;
};

export type AdminDashboardData = {
  metrics: {
    totalUsers: number;
    totalProducts: number;
    activeProducts: number;
    archivedProducts: number;
    totalCategories: number;
    totalOrders: number;
    pendingOrders: number;
    lowStockProducts: number;
    outOfStockProducts: number;
  };
  revenueByCurrency: Array<{
    currency: string;
    amount: string;
  }>;
  recentOrders: AdminOrderSummary[];
};

export type AdminInventory = {
  totalQuantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  stockStatus: 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK';
  updatedAt?: string | null;
};

export type AdminProductSummary = {
  id: string;
  name: string;
  slug: string;
  sku: string;
  price: string;
  currency: string;
  isActive: boolean;
  isFeatured: boolean;
  category: Pick<CatalogCategory, 'id' | 'name' | 'slug' | 'isActive'>;
  image: Pick<ProductImage, 'id' | 'url' | 'altText'> | null;
  inventory: AdminInventory;
  createdAt: string;
  updatedAt: string;
};

export type AdminProductDetail = Omit<AdminProductSummary, 'image'> & {
  categoryId: string;
  description: string;
  images: ProductImage[];
};

export type AdminProductListData = {
  items: AdminProductSummary[];
  pagination: Pagination;
};

export type AdminProductDetailData = {
  product: AdminProductDetail;
};

export type AdminCategory = CatalogCategory & {
  activeProductCount: number;
  productCount: number;
};

export type AdminCategoryListData = {
  items: AdminCategory[];
  pagination: Pagination;
};

export type AdminInventoryItem = {
  id: string;
  name: string;
  sku: string;
  isActive: boolean;
  inventory: AdminInventory;
};

export type AdminInventoryListData = {
  items: AdminInventoryItem[];
  pagination: Pagination;
};

export type AdminOrderCustomer = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  status?: UserStatus;
};

export type AdminOrderSummary = {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  currency: string;
  total: string;
  itemCount?: number;
  customer: AdminOrderCustomer;
  createdAt: string;
  updatedAt?: string;
};

export type OrderStatusHistoryEntry = {
  id: string;
  previousStatus: OrderStatus;
  newStatus: OrderStatus;
  note: string | null;
  actorType: 'ADMIN' | 'SYSTEM';
  administrator: Pick<AdminOrderCustomer, 'id' | 'email' | 'firstName' | 'lastName'> | null;
  systemActor: string | null;
  createdAt: string;
};

export type AdminOrderDetail = Omit<CustomerOrder, 'status'> & {
  status: OrderStatus;
  customer: AdminOrderCustomer;
  statusHistory: OrderStatusHistoryEntry[];
  shipment: Pick<Shipment, 'id' | 'courier' | 'trackingNumber' | 'status'> | null;
};

export type AdminOrderListData = {
  items: AdminOrderSummary[];
  pagination: Pagination;
};

export type AdminOrderDetailData = {
  order: AdminOrderDetail;
};

export type AdminPaymentSummary = PaymentAttempt & {
  order: Pick<AdminOrderSummary, 'id' | 'orderNumber' | 'status' | 'customer'>;
};

export type AdminPaymentListData = {
  items: AdminPaymentSummary[];
  pagination: Pagination;
};

export type AdminPaymentDetailData = {
  payment: AdminPaymentSummary & { refunds: PaymentRefund[] };
  webhookEvents: PaymentWebhookEvent[];
};

export type AdminUserSummary = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  status: UserStatus;
  orderCount: number;
  createdAt: string;
};

export type AdminUserListData = {
  items: AdminUserSummary[];
  pagination: Pagination;
};

export type AdminSystemOverviewData = {
  service: 'aurelia-api';
  apiVersion: string;
  environment: string;
  nodeVersion: string;
  database: 'ready';
  timestamp: string;
  uptimeSeconds: number;
};

export type AdminCategoryWriteRequest = {
  name: string;
  slug?: string;
  description?: string | null;
  isActive?: boolean;
};

export type AdminProductWriteRequest = {
  categoryId: string;
  name: string;
  slug?: string;
  sku: string;
  description: string;
  price: number;
  currency?: string;
  availableQuantity?: number;
  isActive?: boolean;
  isFeatured?: boolean;
};

export type ReviewStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export type ProductReview = {
  id: string;
  productId: string;
  userId: string;
  product: Pick<CatalogProduct, 'id' | 'name' | 'slug'>;
  user: Pick<AuthUser, 'id' | 'firstName' | 'lastName'> & { email?: string };
  rating: number;
  title: string | null;
  body: string;
  status: ReviewStatus;
  moderationNote: string | null;
  moderatedAt: string | null;
  deletedAt: string | null;
  verifiedPurchase: true;
  createdAt: string;
  updatedAt: string;
};

export type ProductReviewListData = {
  items: ProductReview[];
  pagination: Pagination;
  summary: {
    averageRating: string;
    totalReviews: number;
    distribution: Record<string, number>;
  };
  viewerReview: ProductReview | null;
};

export type ReviewWriteRequest = {
  rating: number;
  title?: string | null;
  body: string;
};

export type AdminReviewListData = {
  items: ProductReview[];
  pagination: Pagination;
};

export type AdminReviewUpdateRequest =
  | { action: 'approve'; note?: string }
  | { action: 'reject'; note: string }
  | { action: 'delete'; note?: string }
  | { action: 'restore'; note?: string };

export type CouponType = 'FIXED_AMOUNT' | 'PERCENTAGE';

export type Coupon = {
  id: string;
  code: string;
  description: string | null;
  type: CouponType;
  value: string;
  currency: string;
  minimumOrderValue: string | null;
  startsAt: string | null;
  expiresAt: string | null;
  maximumUses: number | null;
  maximumUsesPerCustomer: number | null;
  isEnabled: boolean;
  totalUses: number;
  createdAt: string;
  updatedAt: string;
};

export type AdminCouponListData = {
  items: Coupon[];
  pagination: Pagination;
};

export type CouponWriteRequest = {
  code: string;
  description?: string | null;
  type: CouponType;
  value: number;
  currency?: string;
  minimumOrderValue?: number | null;
  startsAt?: string | null;
  expiresAt?: string | null;
  maximumUses?: number | null;
  maximumUsesPerCustomer?: number | null;
  isEnabled?: boolean;
};

export type CouponPreview = {
  code: string;
  type: CouponType;
  value: string;
  currency: string;
  subtotal: string;
  discountAmount: string;
  total: string;
};

export type CustomerAddress = ShippingAddressInput & {
  id: string;
  label: string;
  isDefaultShipping: boolean;
  isDefaultBilling: boolean;
  createdAt: string;
  updatedAt: string;
};

export type AddressWriteRequest = ShippingAddressInput & {
  label: string;
  isDefaultShipping?: boolean;
  isDefaultBilling?: boolean;
};

export type AddressListData = { items: CustomerAddress[] };

export type AccountSummaryData = {
  profile: AuthUser;
  stats: {
    addressCount: number;
    deliveredOrderCount: number;
    deliveredOrderSpend: string;
    openReturnCount: number;
    openSupportTicketCount: number;
    returnCount: number;
    supportTicketCount: number;
    wishlistItemCount: number;
  };
};

export type ProfileUpdateRequest = {
  firstName?: string;
  lastName?: string;
  phone?: string | null;
  avatarUrl?: string | null;
  avatarAltText?: string | null;
};

export type DiscoveryProduct = CatalogProduct & {
  rating: { average: string; count: number };
  soldQuantity: number;
};

export type SearchData = {
  items: DiscoveryProduct[];
  pagination: Pagination;
};

export type SearchSuggestion = {
  id: string;
  name: string;
  slug: string;
  categoryName: string;
  image: { url: string; altText: string | null } | null;
};

export type RecommendationType =
  'related' | 'recently_viewed' | 'featured' | 'newest' | 'best_sellers' | 'trending';

export type RecommendationData = {
  items: DiscoveryProduct[];
  type: RecommendationType;
};

export type AdminInventoryUpdateRequest = {
  totalQuantity: number;
};

export type AdminOrderStatusUpdateRequest = {
  status: OrderStatus;
  note?: string;
};

export type AdminPaymentStatusUpdateRequest =
  | {
      status: 'SUCCEEDED';
    }
  | {
      status: 'FAILED';
      failureReason: string;
    };

export type AdminPaymentRefundRequest = {
  amount: string;
  reason?: string;
};
