import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { CommerceProductImage } from '../components/commerce-product-image';
import { SiteHeader } from '../components/site-header';
import { getApiErrorMessage } from '../lib/api-error';
import { commerceApi, commerceQueryKeys } from '../lib/commerce-api';
import { formatPrice } from '../lib/format-price';

export const WishlistPage = () => {
  const queryClient = useQueryClient();
  const wishlistQuery = useQuery({
    queryFn: commerceApi.getWishlist,
    queryKey: commerceQueryKeys.wishlist,
  });
  const refreshWishlist = async () =>
    queryClient.invalidateQueries({ queryKey: commerceQueryKeys.wishlist });
  const removeItem = useMutation({
    mutationFn: commerceApi.removeWishlistItem,
    onError: (error) => toast.error(getApiErrorMessage(error)),
    onSuccess: refreshWishlist,
  });
  const moveToCart = useMutation({
    mutationFn: async (productId: string) => {
      await commerceApi.addCartItem({ productId, quantity: 1 });
      await commerceApi.removeWishlistItem(productId);
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: commerceQueryKeys.cart }),
        queryClient.invalidateQueries({ queryKey: commerceQueryKeys.wishlist }),
      ]);
      toast.success('Moved to your cart.');
    },
  });
  const wishlist = wishlistQuery.data?.wishlist;

  return (
    <>
      <Helmet>
        <title>Wishlist — Veyora</title>
      </Helmet>
      <main className="bg-porcelain min-h-screen px-6 py-8 sm:px-10 lg:px-16">
        <div className="mx-auto w-full max-w-7xl">
          <SiteHeader />
          <section className="py-16">
            <p className="text-champagne text-xs font-semibold tracking-[0.24em] uppercase">
              Saved for later
            </p>
            <h1 className="font-display mt-5 text-6xl">Your wishlist</h1>

            {wishlistQuery.isPending ? (
              <div className="bg-mist mt-12 h-80 animate-pulse rounded-[2rem]" />
            ) : null}
            {wishlistQuery.isError ? (
              <div className="mt-12 rounded-[1.5rem] border border-red-200 bg-red-50 p-8">
                <p>{getApiErrorMessage(wishlistQuery.error)}</p>
                <button
                  className="mt-4 font-semibold underline"
                  onClick={() => void wishlistQuery.refetch()}
                >
                  Try again
                </button>
              </div>
            ) : null}
            {wishlist && wishlist.items.length === 0 ? (
              <div className="border-ink/10 mt-12 rounded-[2rem] border p-14 text-center">
                <h2 className="font-display text-4xl">Nothing saved yet.</h2>
                <p className="text-ink/55 mt-3">
                  Keep your favorite pieces close while you decide.
                </p>
                <Link
                  className="bg-ink mt-7 inline-block rounded-full px-7 py-3 text-xs font-semibold tracking-[0.12em] text-white uppercase"
                  to="/products"
                >
                  Explore collection
                </Link>
              </div>
            ) : null}
            {wishlist?.items.length ? (
              <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
                {wishlist.items.map((item) => (
                  <article key={item.id}>
                    <Link
                      className="bg-mist block aspect-[4/5] overflow-hidden rounded-[1.5rem]"
                      to={`/products/${item.product.slug}`}
                    >
                      <CommerceProductImage product={item.product} />
                    </Link>
                    <p className="text-champagne mt-5 text-[0.65rem] font-semibold tracking-[0.14em] uppercase">
                      {item.product.category.name}
                    </p>
                    <div className="mt-2 flex justify-between gap-4">
                      <Link className="font-display text-2xl" to={`/products/${item.product.slug}`}>
                        {item.product.name}
                      </Link>
                      <span className="shrink-0 text-sm">
                        {formatPrice(item.product.price, item.product.currency)}
                      </span>
                    </div>
                    {!item.isAvailable ? (
                      <p className="mt-3 text-sm text-red-700">Currently unavailable</p>
                    ) : null}
                    <div className="mt-5 flex gap-3">
                      <button
                        className="bg-ink flex-1 rounded-full px-5 py-3 text-xs font-semibold tracking-[0.1em] text-white uppercase disabled:opacity-40"
                        disabled={!item.isAvailable || moveToCart.isPending}
                        onClick={() => moveToCart.mutate(item.product.id)}
                        type="button"
                      >
                        Move to cart
                      </button>
                      <button
                        aria-label={`Remove ${item.product.name} from wishlist`}
                        className="border-ink/15 rounded-full border px-5 text-xs font-semibold uppercase"
                        disabled={removeItem.isPending}
                        onClick={() => removeItem.mutate(item.product.id)}
                        type="button"
                      >
                        Remove
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            ) : null}
          </section>
        </div>
      </main>
    </>
  );
};
