import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { SiteHeader } from '../components/site-header';
import { ProductReviews } from '../components/product-reviews';
import { RecommendationSection } from '../components/recommendation-section';
import { getApiErrorMessage } from '../lib/api-error';
import { resolveAssetUrl } from '../lib/asset-url';
import { catalogApi } from '../lib/catalog-api';
import { commerceApi, commerceQueryKeys } from '../lib/commerce-api';
import { formatPrice } from '../lib/format-price';
import { useAuthStore } from '../stores/auth-store';
import { discoveryApi } from '../lib/discovery-api';

export const ProductDetailPage = () => {
  const { slug = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const productQuery = useQuery({
    enabled: Boolean(slug),
    queryFn: () => catalogApi.getProduct(slug),
    queryKey: ['catalog', 'product', slug],
  });
  const product = productQuery.data?.product;
  useEffect(() => {
    if (!user || !product) return;
    void discoveryApi.recordView(product.id).catch(() => undefined);
  }, [product, user]);
  const addToCart = useMutation({
    mutationFn: (productId: string) => commerceApi.addCartItem({ productId, quantity: 1 }),
    onError: (error) => toast.error(getApiErrorMessage(error)),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: commerceQueryKeys.cart });
      toast.success('Added to your cart.');
    },
  });
  const addToWishlist = useMutation({
    mutationFn: commerceApi.addWishlistItem,
    onError: (error) => toast.error(getApiErrorMessage(error)),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: commerceQueryKeys.wishlist });
      toast.success('Saved to your wishlist.');
    },
  });

  const requireUser = (action: () => void) => {
    if (!user) {
      void navigate('/login');
      return;
    }
    action();
  };

  return (
    <>
      <Helmet>
        <title>{product ? `${product.name} — Veyora` : 'Product — Veyora'}</title>
        {product ? <meta name="description" content={product.description.slice(0, 155)} /> : null}
        {product?.images[0] ? (
          <link as="image" href={resolveAssetUrl(product.images[0].url)} rel="preload" />
        ) : null}
      </Helmet>
      <main className="bg-porcelain min-h-screen px-6 py-8 sm:px-10 lg:px-16">
        <div className="mx-auto w-full max-w-7xl">
          <SiteHeader />
          {productQuery.isPending ? (
            <section className="grid gap-12 py-16 lg:grid-cols-2">
              <div className="bg-mist aspect-[4/5] animate-pulse rounded-[2rem]" />
              <div className="space-y-6 py-8">
                <div className="bg-mist h-3 w-28 animate-pulse" />
                <div className="bg-mist h-16 w-3/4 animate-pulse" />
                <div className="bg-mist h-24 w-full animate-pulse" />
              </div>
            </section>
          ) : null}

          {productQuery.isError ? (
            <section className="py-24 text-center">
              <h1 className="font-display text-5xl">This piece could not be found.</h1>
              <p className="text-ink/55 mt-4">{getApiErrorMessage(productQuery.error)}</p>
              <Link className="mt-8 inline-block font-semibold underline" to="/products">
                Return to the collection
              </Link>
            </section>
          ) : null}

          {product ? (
            <section className="grid gap-12 py-16 lg:grid-cols-[1.1fr_0.9fr] lg:gap-20">
              <div className="grid gap-5 sm:grid-cols-2">
                {product.images.length ? (
                  product.images.map((image, index) => (
                    <div
                      className={`bg-mist overflow-hidden rounded-[2rem] ${
                        index === 0 ? 'sm:col-span-2' : ''
                      }`}
                      key={image.id}
                    >
                      <img
                        alt={image.altText ?? product.name}
                        className="aspect-[4/5] size-full object-cover"
                        decoding="async"
                        fetchPriority={index === 0 ? 'high' : 'auto'}
                        loading={index === 0 ? 'eager' : 'lazy'}
                        sizes={index === 0 ? '(min-width: 1024px) 55vw, 100vw' : '50vw'}
                        src={resolveAssetUrl(image.url)}
                      />
                    </div>
                  ))
                ) : (
                  <div className="bg-mist text-ink/25 grid aspect-[4/5] place-items-center rounded-[2rem] sm:col-span-2">
                    <span className="font-display text-8xl">A</span>
                  </div>
                )}
              </div>
              <div className="py-4 lg:sticky lg:top-8 lg:self-start">
                <Link
                  className="text-champagne text-xs font-semibold tracking-[0.2em] uppercase"
                  to={`/products?category=${product.category.slug}`}
                >
                  {product.category.name}
                </Link>
                <h1 className="font-display mt-5 text-6xl leading-[1.02]">{product.name}</h1>
                <p className="mt-7 text-xl">{formatPrice(product.price, product.currency)}</p>
                <div className="mt-8 flex gap-3">
                  <button
                    className="bg-ink flex-1 rounded-full px-6 py-3.5 text-xs font-semibold tracking-[0.12em] text-white uppercase disabled:opacity-40"
                    disabled={!product.inventory.inStock || addToCart.isPending}
                    onClick={() => addToCart.mutate(product.id)}
                    type="button"
                  >
                    {product.inventory.inStock ? 'Add to cart' : 'Out of stock'}
                  </button>
                  <button
                    className="border-ink/15 rounded-full border px-6 py-3.5 text-xs font-semibold tracking-[0.1em] uppercase"
                    disabled={addToWishlist.isPending}
                    onClick={() => requireUser(() => addToWishlist.mutate(product.id))}
                    type="button"
                  >
                    Save
                  </button>
                </div>
                <div className="bg-ink/10 my-9 h-px" />
                <p className="text-ink/65 leading-8 whitespace-pre-line">{product.description}</p>
                <dl className="mt-10 space-y-4 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-ink/45">Availability</dt>
                    <dd>{product.inventory.inStock ? 'In stock' : 'Out of stock'}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-ink/45">SKU</dt>
                    <dd>{product.sku}</dd>
                  </div>
                </dl>
              </div>
            </section>
          ) : null}
          {product ? <ProductReviews productId={product.id} /> : null}
          {product ? (
            <RecommendationSection
              productId={product.id}
              title="You may also like"
              type="related"
            />
          ) : null}
          {user ? <RecommendationSection title="Recently viewed" type="recently_viewed" /> : null}
        </div>
      </main>
    </>
  );
};
