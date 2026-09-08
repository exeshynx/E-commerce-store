import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { CommerceProductImage } from '../components/commerce-product-image';
import { SiteHeader } from '../components/site-header';
import { getApiErrorMessage } from '../lib/api-error';
import { commerceApi, commerceQueryKeys } from '../lib/commerce-api';
import { formatPrice } from '../lib/format-price';

const unavailableMessages = {
  CATEGORY_INACTIVE: 'This product category is no longer available.',
  INSUFFICIENT_STOCK: 'There is not enough stock for this quantity.',
  OUT_OF_STOCK: 'This product is currently out of stock.',
  PRODUCT_INACTIVE: 'This product is no longer available.',
} as const;

export const CartPage = () => {
  const queryClient = useQueryClient();
  const cartQuery = useQuery({
    queryFn: commerceApi.getCart,
    queryKey: commerceQueryKeys.cart,
  });
  const refreshCart = async () =>
    queryClient.invalidateQueries({ queryKey: commerceQueryKeys.cart });
  const updateItem = useMutation({
    mutationFn: ({ id, quantity }: { id: string; quantity: number }) =>
      commerceApi.updateCartItem(id, { quantity }),
    onError: (error) => toast.error(getApiErrorMessage(error)),
    onSuccess: (data) => queryClient.setQueryData(commerceQueryKeys.cart, data),
  });
  const removeItem = useMutation({
    mutationFn: commerceApi.removeCartItem,
    onError: (error) => toast.error(getApiErrorMessage(error)),
    onSuccess: refreshCart,
  });
  const clearCart = useMutation({
    mutationFn: commerceApi.clearCart,
    onError: (error) => toast.error(getApiErrorMessage(error)),
    onSuccess: refreshCart,
  });
  const cart = cartQuery.data?.cart;

  return (
    <>
      <Helmet>
        <title>Shopping Cart — Veyora</title>
      </Helmet>
      <main className="bg-porcelain min-h-screen px-6 py-8 sm:px-10 lg:px-16">
        <div className="mx-auto w-full max-w-7xl">
          <SiteHeader />
          <section className="py-16">
            <p className="text-champagne text-xs font-semibold tracking-[0.24em] uppercase">
              Your selection
            </p>
            <div className="mt-5 flex items-end justify-between gap-6">
              <h1 className="font-display text-6xl">Shopping cart</h1>
              {cart?.items.length ? (
                <button
                  className="text-ink/50 text-xs font-semibold tracking-[0.12em] uppercase underline underline-offset-4"
                  disabled={clearCart.isPending}
                  onClick={() => clearCart.mutate()}
                  type="button"
                >
                  Clear cart
                </button>
              ) : null}
            </div>

            {cartQuery.isPending ? (
              <div className="mt-12 space-y-5" aria-label="Loading cart">
                {[0, 1].map((item) => (
                  <div className="bg-mist h-40 animate-pulse rounded-[1.5rem]" key={item} />
                ))}
              </div>
            ) : null}

            {cartQuery.isError ? (
              <div className="mt-12 rounded-[1.5rem] border border-red-200 bg-red-50 p-8">
                <p>{getApiErrorMessage(cartQuery.error)}</p>
                <button
                  className="mt-4 font-semibold underline"
                  onClick={() => void cartQuery.refetch()}
                >
                  Try again
                </button>
              </div>
            ) : null}

            {cart && cart.items.length === 0 ? (
              <div className="border-ink/10 mt-12 rounded-[2rem] border p-14 text-center">
                <h2 className="font-display text-4xl">Your cart is waiting.</h2>
                <p className="text-ink/55 mt-3">
                  Explore the collection and choose something memorable.
                </p>
                <Link
                  className="bg-ink mt-7 inline-block rounded-full px-7 py-3 text-xs font-semibold tracking-[0.12em] text-white uppercase"
                  to="/products"
                >
                  Browse products
                </Link>
              </div>
            ) : null}

            {cart?.items.length ? (
              <div className="mt-12 grid gap-10 lg:grid-cols-[1fr_22rem]">
                <div className="space-y-5">
                  {cart.items.map((item) => (
                    <article
                      className="border-ink/10 grid grid-cols-[7rem_1fr] gap-5 rounded-[1.5rem] border bg-white/45 p-4 sm:grid-cols-[9rem_1fr]"
                      key={item.id}
                    >
                      <Link
                        className="bg-mist aspect-[4/5] overflow-hidden rounded-xl"
                        to={`/products/${item.product.slug}`}
                      >
                        <CommerceProductImage product={item.product} />
                      </Link>
                      <div className="flex min-w-0 flex-col justify-between py-1">
                        <div className="flex justify-between gap-4">
                          <div>
                            <p className="text-champagne text-[0.65rem] font-semibold tracking-[0.14em] uppercase">
                              {item.product.category.name}
                            </p>
                            <Link
                              className="font-display mt-1 block text-2xl"
                              to={`/products/${item.product.slug}`}
                            >
                              {item.product.name}
                            </Link>
                            <p className="text-ink/45 mt-1 text-xs">
                              Snapshot: {formatPrice(item.unitPrice, item.currency)}
                            </p>
                          </div>
                          <p className="shrink-0 text-sm">
                            {formatPrice(item.lineSubtotal, item.currency)}
                          </p>
                        </div>
                        {!item.isAvailable && item.unavailableReason ? (
                          <p className="mt-3 text-sm text-red-700" role="status">
                            {unavailableMessages[item.unavailableReason]}
                          </p>
                        ) : null}
                        <div className="mt-5 flex items-center justify-between gap-4">
                          <div className="border-ink/15 flex items-center rounded-full border">
                            <button
                              aria-label={`Decrease ${item.product.name} quantity`}
                              className="size-9 text-lg disabled:opacity-30"
                              disabled={!item.isAvailable || updateItem.isPending}
                              onClick={() =>
                                item.quantity === 1
                                  ? removeItem.mutate(item.id)
                                  : updateItem.mutate({ id: item.id, quantity: item.quantity - 1 })
                              }
                              type="button"
                            >
                              −
                            </button>
                            <span className="min-w-8 text-center text-sm">{item.quantity}</span>
                            <button
                              aria-label={`Increase ${item.product.name} quantity`}
                              className="size-9 text-lg disabled:opacity-30"
                              disabled={!item.isAvailable || updateItem.isPending}
                              onClick={() =>
                                updateItem.mutate({ id: item.id, quantity: item.quantity + 1 })
                              }
                              type="button"
                            >
                              +
                            </button>
                          </div>
                          <button
                            className="text-ink/50 text-xs font-semibold uppercase underline"
                            disabled={removeItem.isPending}
                            onClick={() => removeItem.mutate(item.id)}
                            type="button"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
                <aside className="h-fit rounded-[1.5rem] bg-white/65 p-7 shadow-[0_20px_60px_rgba(65,50,30,0.07)] lg:sticky lg:top-8">
                  <h2 className="font-display text-3xl">Summary</h2>
                  <div className="border-ink/10 mt-6 flex justify-between border-b pb-5 text-sm">
                    <span className="text-ink/55">Total quantity</span>
                    <span>{cart.totalQuantity}</span>
                  </div>
                  <div className="mt-5 flex justify-between">
                    <span>Subtotal</span>
                    <strong>
                      {cart.currency ? formatPrice(cart.subtotal, cart.currency) : '—'}
                    </strong>
                  </div>
                  <p className="text-ink/45 mt-5 text-xs leading-5">
                    Unavailable items are excluded. Prices and inventory will be revalidated at
                    checkout.
                  </p>
                  {cart.items.every((item) => item.isAvailable) ? (
                    <Link
                      className="bg-ink mt-6 block rounded-full px-6 py-3.5 text-center text-xs font-semibold tracking-[0.12em] text-white uppercase"
                      to="/checkout"
                    >
                      Continue to checkout
                    </Link>
                  ) : (
                    <p className="mt-5 rounded-xl bg-red-50 p-3 text-sm text-red-800">
                      Remove unavailable items before checkout.
                    </p>
                  )}
                </aside>
              </div>
            ) : null}
          </section>
        </div>
      </main>
    </>
  );
};
