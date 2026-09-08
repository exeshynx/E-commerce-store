import { useQuery } from '@tanstack/react-query';
import { catalogApi } from '../lib/catalog-api';
import { commerceApi, commerceQueryKeys } from '../lib/commerce-api';
import { useAuthStore } from '../stores/auth-store';
import { PrefetchLink } from './prefetch-link';

export const SiteHeader = () => {
  const user = useAuthStore((state) => state.user);
  const categories = useQuery({
    queryFn: catalogApi.getCategories,
    queryKey: ['catalog', 'categories'],
  });
  const cart = useQuery({ queryFn: commerceApi.getCart, queryKey: commerceQueryKeys.cart });

  return (
    <header className="border-ink/10 flex items-center justify-between border-b pb-6">
      <PrefetchLink
        className="font-display text-2xl tracking-[0.12em]"
        to="/"
        aria-label="Veyora home"
      >
        VEYORA
      </PrefetchLink>
      <nav
        className="flex flex-wrap items-center justify-end gap-3 sm:gap-5"
        aria-label="Primary navigation"
      >
        {categories.data?.items.slice(0, 4).map((category) => (
          <PrefetchLink
            className="text-ink/60 hidden text-[0.68rem] font-semibold tracking-[0.16em] uppercase hover:text-black md:block"
            key={category.id}
            to={`/products?category=${category.slug}`}
          >
            {category.name}
          </PrefetchLink>
        ))}
        <PrefetchLink
          className="text-ink/60 text-[0.68rem] font-semibold tracking-[0.16em] uppercase hover:text-black"
          to="/search"
        >
          Search
        </PrefetchLink>
        {user ? (
          <>
            {user.role === 'ADMIN' ? (
              <PrefetchLink
                className="text-champagne text-[0.68rem] font-semibold tracking-[0.12em] uppercase hover:text-black"
                to="/admin"
              >
                Admin
              </PrefetchLink>
            ) : null}
            <PrefetchLink
              className="text-ink/60 text-[0.68rem] font-semibold tracking-[0.12em] uppercase hover:text-black"
              to="/wishlist"
            >
              Wishlist
            </PrefetchLink>
            <PrefetchLink
              className="text-ink/60 text-[0.68rem] font-semibold tracking-[0.12em] uppercase hover:text-black"
              to="/orders"
            >
              Orders
            </PrefetchLink>
            <PrefetchLink
              className="text-ink/60 text-[0.68rem] font-semibold tracking-[0.12em] uppercase hover:text-black"
              to="/returns"
            >
              Returns
            </PrefetchLink>
            <PrefetchLink
              className="text-ink/60 text-[0.68rem] font-semibold tracking-[0.12em] uppercase hover:text-black"
              to="/support"
            >
              Support
            </PrefetchLink>
          </>
        ) : null}
        <PrefetchLink
          className="text-ink/60 text-[0.68rem] font-semibold tracking-[0.12em] uppercase hover:text-black"
          to="/cart"
        >
          Cart{cart.data?.cart.totalQuantity ? ` (${cart.data.cart.totalQuantity})` : ''}
        </PrefetchLink>
        {!user ? (
          <PrefetchLink
            className="text-ink/60 hidden text-[0.68rem] font-semibold tracking-[0.12em] uppercase hover:text-black sm:block"
            to="/register"
          >
            Sign up
          </PrefetchLink>
        ) : null}
        <PrefetchLink
          className="text-ink border-ink/15 rounded-full border px-4 py-2 text-[0.68rem] font-semibold tracking-[0.16em] uppercase"
          to={user ? '/account' : '/login'}
        >
          {user ? 'Account' : 'Sign in'}
        </PrefetchLink>
      </nav>
    </header>
  );
};
