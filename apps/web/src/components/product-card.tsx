import type { CatalogProduct } from '@aurelia/contracts';
import { memo } from 'react';
import { Link } from 'react-router-dom';
import { resolveAssetUrl } from '../lib/asset-url';

const formatPrice = (price: string, currency: string) =>
  new Intl.NumberFormat('en-PK', {
    currency,
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
    style: 'currency',
  }).format(Number(price));

export const ProductCard = memo(({ product }: { product: CatalogProduct }) => {
  const primaryImage = product.images[0];

  return (
    <article>
      <Link className="group block" to={`/products/${product.slug}`}>
        <div className="bg-mist relative aspect-[4/5] overflow-hidden rounded-[1.5rem]">
          {primaryImage ? (
            <img
              alt={primaryImage.altText ?? product.name}
              className="size-full object-cover transition duration-500 group-hover:scale-[1.03]"
              decoding="async"
              loading="lazy"
              sizes="(min-width: 1024px) 30vw, (min-width: 640px) 45vw, 90vw"
              src={resolveAssetUrl(primaryImage.url)}
            />
          ) : (
            <div className="text-ink/30 grid size-full place-items-center">
              <span className="font-display text-5xl">A</span>
            </div>
          )}
          {!product.inventory.inStock ? (
            <span className="absolute top-4 left-4 rounded-full bg-white/90 px-3 py-1 text-[0.65rem] font-semibold tracking-[0.14em] uppercase">
              Out of stock
            </span>
          ) : null}
        </div>
        <p className="text-champagne mt-5 text-[0.68rem] font-semibold tracking-[0.16em] uppercase">
          {product.category.name}
        </p>
        <div className="mt-2 flex items-start justify-between gap-4">
          <h2 className="font-display text-2xl leading-tight">{product.name}</h2>
          <p className="text-ink/65 shrink-0 text-sm">
            {formatPrice(product.price, product.currency)}
          </p>
        </div>
        {product.rating ? (
          <p
            className="text-ink/50 mt-2 text-xs"
            aria-label={`${product.rating.average} out of 5 stars`}
          >
            <span aria-hidden="true">★</span> {Number(product.rating.average).toFixed(1)} ·{' '}
            {product.rating.count} {product.rating.count === 1 ? 'review' : 'reviews'}
          </p>
        ) : null}
      </Link>
    </article>
  );
});
ProductCard.displayName = 'ProductCard';

export const ProductCardSkeleton = () => (
  <div aria-hidden="true">
    <div className="bg-mist aspect-[4/5] animate-pulse rounded-[1.5rem]" />
    <div className="bg-mist mt-5 h-3 w-20 animate-pulse rounded" />
    <div className="bg-mist mt-3 h-7 w-3/4 animate-pulse rounded" />
  </div>
);
