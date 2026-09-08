import { lazy, Suspense, useEffect, useRef, type ReactNode } from 'react';
import { Helmet } from 'react-helmet-async';
import { Route, Routes, useLocation } from 'react-router-dom';
import { AppErrorBoundary } from './app-error-boundary';
import { ProtectedRoute } from './protected-route';

const FoundationPage = lazy(() =>
  import('../pages/foundation-page').then((module) => ({ default: module.FoundationPage })),
);
const LoginPage = lazy(() =>
  import('../pages/login-page').then((module) => ({ default: module.LoginPage })),
);
const RegisterPage = lazy(() =>
  import('../pages/register-page').then((module) => ({ default: module.RegisterPage })),
);
const ProductsPage = lazy(() =>
  import('../pages/products-page').then((module) => ({ default: module.ProductsPage })),
);
const ProductDetailPage = lazy(() =>
  import('../pages/product-detail-page').then((module) => ({ default: module.ProductDetailPage })),
);
const CartPage = lazy(() =>
  import('../pages/cart-page').then((module) => ({ default: module.CartPage })),
);
const WishlistPage = lazy(() =>
  import('../pages/wishlist-page').then((module) => ({ default: module.WishlistPage })),
);
const CheckoutPage = lazy(() =>
  import('../pages/checkout-page').then((module) => ({ default: module.CheckoutPage })),
);
const OrdersPage = lazy(() =>
  import('../pages/orders-page').then((module) => ({ default: module.OrdersPage })),
);
const OrderDetailPage = lazy(() =>
  import('../pages/order-detail-page').then((module) => ({ default: module.OrderDetailPage })),
);
const OrderConfirmationPage = lazy(() =>
  import('../pages/order-confirmation-page').then((module) => ({
    default: module.OrderConfirmationPage,
  })),
);
const SafepayReturnPage = lazy(() =>
  import('../pages/safepay-return-page').then((module) => ({ default: module.SafepayReturnPage })),
);
const ShipmentTrackingPage = lazy(() =>
  import('../pages/shipment-tracking-page').then((module) => ({
    default: module.ShipmentTrackingPage,
  })),
);
const AccountPage = lazy(() =>
  import('../pages/account-page').then((module) => ({ default: module.AccountPage })),
);
const AddressesPage = lazy(() =>
  import('../pages/addresses-page').then((module) => ({ default: module.AddressesPage })),
);
const ReturnsPage = lazy(() =>
  import('../pages/returns-page').then((module) => ({ default: module.ReturnsPage })),
);
const ReturnDetailPage = lazy(() =>
  import('../pages/return-detail-page').then((module) => ({ default: module.ReturnDetailPage })),
);
const CreateReturnPage = lazy(() =>
  import('../pages/create-return-page').then((module) => ({ default: module.CreateReturnPage })),
);
const ReturnTrackingPage = lazy(() =>
  import('../pages/return-tracking-page').then((module) => ({
    default: module.ReturnTrackingPage,
  })),
);
const SupportTicketsPage = lazy(() =>
  import('../pages/support-tickets-page').then((module) => ({
    default: module.SupportTicketsPage,
  })),
);
const SupportConversationPage = lazy(() =>
  import('../pages/support-conversation-page').then((module) => ({
    default: module.SupportConversationPage,
  })),
);
const AdminRoutes = lazy(() =>
  import('../admin/admin-routes').then((module) => ({ default: module.AdminRoutes })),
);

const loading = (
  <main className="bg-porcelain grid min-h-screen place-items-center" aria-busy="true">
    <div className="text-center">
      <div className="border-champagne mx-auto size-10 animate-spin rounded-full border-2 border-t-transparent" />
      <p className="text-ink/55 mt-4 text-xs tracking-wider uppercase">Loading page…</p>
    </div>
  </main>
);
const protect = (element: ReactNode, role?: 'ADMIN') => (
  <ProtectedRoute {...(role ? { requiredRole: role } : {})}>{element}</ProtectedRoute>
);

export const App = () => {
  const location = useLocation();
  const previousPath = useRef(location.pathname);
  useEffect(() => {
    if (previousPath.current === location.pathname) return;
    previousPath.current = location.pathname;
    document.getElementById('main-content')?.focus({ preventScroll: true });
  }, [location.pathname]);
  return (
    <>
      <Helmet>
        <title>Veyora — New-season fashion and everyday essentials</title>
        <meta
          name="description"
          content="Shop Veyora fashion, streetwear, layers, and everyday essentials."
        />
      </Helmet>
      <a
        className="bg-ink fixed top-3 left-3 z-[100] -translate-y-20 rounded-lg px-4 py-3 text-sm font-semibold text-white transition focus:translate-y-0"
        href="#main-content"
      >
        Skip to main content
      </a>
      <span aria-live="polite" className="sr-only" key={location.pathname}>
        Page changed to {location.pathname === '/' ? 'home' : location.pathname}.
      </span>
      <AppErrorBoundary pathname={location.pathname}>
        <div id="main-content" tabIndex={-1}>
          <Suspense fallback={loading}>
            <Routes>
              <Route path="/" element={<FoundationPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/products" element={<ProductsPage />} />
              <Route path="/search" element={<ProductsPage />} />
              <Route path="/products/:slug" element={<ProductDetailPage />} />
              <Route path="/admin/*" element={protect(<AdminRoutes />, 'ADMIN')} />
              <Route path="/cart" element={<CartPage />} />
              <Route path="/wishlist" element={protect(<WishlistPage />)} />
              <Route path="/checkout" element={<CheckoutPage />} />
              <Route path="/orders" element={protect(<OrdersPage />)} />
              <Route path="/orders/:id" element={<OrderDetailPage />} />
              <Route path="/orders/:id/confirmation" element={<OrderConfirmationPage />} />
              <Route path="/orders/:id/tracking" element={protect(<ShipmentTrackingPage />)} />
              <Route path="/payments/safepay/return" element={<SafepayReturnPage />} />
              <Route path="/account" element={protect(<AccountPage />)} />
              <Route path="/account/addresses" element={protect(<AddressesPage />)} />
              <Route path="/returns" element={protect(<ReturnsPage />)} />
              <Route path="/returns/:id" element={protect(<ReturnDetailPage />)} />
              <Route path="/returns/:id/tracking" element={protect(<ReturnTrackingPage />)} />
              <Route path="/orders/:orderId/return" element={protect(<CreateReturnPage />)} />
              <Route path="/support" element={protect(<SupportTicketsPage />)} />
              <Route path="/support/:id" element={protect(<SupportConversationPage />)} />
              <Route path="*" element={<FoundationPage />} />
            </Routes>
          </Suspense>
        </div>
      </AppErrorBoundary>
    </>
  );
};
