const routeImporters = {
  account: () => import('../pages/account-page'),
  addresses: () => import('../pages/addresses-page'),
  admin: () => import('../admin/admin-routes'),
  cart: () => import('../pages/cart-page'),
  checkout: () => import('../pages/checkout-page'),
  home: () => import('../pages/foundation-page'),
  orders: () => import('../pages/orders-page'),
  product: () => import('../pages/product-detail-page'),
  products: () => import('../pages/products-page'),
  returns: () => import('../pages/returns-page'),
  support: () => import('../pages/support-tickets-page'),
  wishlist: () => import('../pages/wishlist-page'),
} as const;

const importerFor = (path: string) => {
  if (path === '/') return routeImporters.home;
  if (path.startsWith('/admin')) return routeImporters.admin;
  if (path === '/account/addresses') return routeImporters.addresses;
  if (path.startsWith('/account')) return routeImporters.account;
  if (path === '/products' || path.startsWith('/search')) return routeImporters.products;
  if (path.startsWith('/products/')) return routeImporters.product;
  if (path.startsWith('/cart')) return routeImporters.cart;
  if (path.startsWith('/wishlist')) return routeImporters.wishlist;
  if (path.startsWith('/checkout')) return routeImporters.checkout;
  if (path.startsWith('/orders')) return routeImporters.orders;
  if (path.startsWith('/returns')) return routeImporters.returns;
  if (path.startsWith('/support')) return routeImporters.support;
  return undefined;
};

export const prefetchRoute = (path: string) => {
  const importer = importerFor(path);
  if (importer) void importer();
};
