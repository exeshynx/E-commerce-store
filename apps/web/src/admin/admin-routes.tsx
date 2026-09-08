import { lazy, Suspense, type ComponentType } from 'react';
import { Route, Routes } from 'react-router-dom';
import { AdminLayout } from './components/admin-layout';

const page = <T extends Record<string, unknown>>(loader: () => Promise<T>, name: keyof T) =>
  lazy(async () => ({ default: (await loader())[name] as ComponentType }));
const Dashboard = page(() => import('./pages/dashboard-page'), 'AdminDashboardPage');
const Products = page(() => import('./pages/products-page'), 'AdminProductsPage');
const Categories = page(() => import('./pages/categories-page'), 'AdminCategoriesPage');
const Inventory = page(() => import('./pages/inventory-page'), 'AdminInventoryPage');
const Orders = page(() => import('./pages/orders-page'), 'AdminOrdersPage');
const OrderDetail = page(() => import('./pages/order-detail-page'), 'AdminOrderDetailPage');
const Shipments = page(() => import('./pages/shipments-page'), 'AdminShipmentsPage');
const ShipmentDetail = page(
  () => import('./pages/shipment-detail-page'),
  'AdminShipmentDetailPage',
);
const Payments = page(() => import('./pages/payments-page'), 'AdminPaymentsPage');
const PaymentDetail = page(() => import('./pages/payment-detail-page'), 'AdminPaymentDetailPage');
const Users = page(() => import('./pages/users-page'), 'AdminUsersPage');
const System = page(() => import('./pages/system-page'), 'AdminSystemPage');
const Audit = page(() => import('./pages/audit-page'), 'AdminAuditPage');
const Returns = page(() => import('./pages/returns-page'), 'AdminReturnsPage');
const ReturnDetail = page(() => import('./pages/return-detail-page'), 'AdminReturnDetailPage');
const Support = page(() => import('./pages/support-page'), 'AdminSupportPage');
const SupportDetail = page(() => import('./pages/support-detail-page'), 'AdminSupportDetailPage');
const Reviews = page(() => import('./pages/reviews-page'), 'AdminReviewsPage');
const Coupons = page(() => import('./pages/coupons-page'), 'AdminCouponsPage');
const Featured = page(() => import('./pages/featured-products-page'), 'AdminFeaturedProductsPage');
const Campaigns = page(() => import('./pages/campaigns-page'), 'AdminCampaignsPage');
const CommerceActivity = page(
  () => import('./pages/commerce-activity-page'),
  'AdminCommerceActivityPage',
);
const fallback = (
  <div className="space-y-3" aria-busy="true">
    {Array.from({ length: 5 }, (_, index) => (
      <div className="bg-mist h-16 animate-pulse rounded-xl" key={index} />
    ))}
  </div>
);

export const AdminRoutes = () => (
  <Suspense fallback={fallback}>
    <Routes>
      <Route element={<AdminLayout />}>
        <Route index element={<Dashboard />} />
        <Route path="products" element={<Products />} />
        <Route path="categories" element={<Categories />} />
        <Route path="inventory" element={<Inventory />} />
        <Route path="featured" element={<Featured />} />
        <Route path="campaigns" element={<Campaigns />} />
        <Route path="commerce-activity" element={<CommerceActivity />} />
        <Route path="reviews" element={<Reviews />} />
        <Route path="coupons" element={<Coupons />} />
        <Route path="orders" element={<Orders />} />
        <Route path="orders/:id" element={<OrderDetail />} />
        <Route path="shipments" element={<Shipments />} />
        <Route path="shipments/:id" element={<ShipmentDetail />} />
        <Route path="payments" element={<Payments />} />
        <Route path="payments/:id" element={<PaymentDetail />} />
        <Route path="users" element={<Users />} />
        <Route path="system" element={<System />} />
        <Route path="audit" element={<Audit />} />
        <Route path="returns" element={<Returns />} />
        <Route path="returns/:id" element={<ReturnDetail />} />
        <Route path="support" element={<Support />} />
        <Route path="support/:id" element={<SupportDetail />} />
      </Route>
    </Routes>
  </Suspense>
);
