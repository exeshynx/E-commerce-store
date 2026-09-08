import type { CommerceProduct } from '@aurelia/contracts';
import { resolveAssetUrl } from '../lib/asset-url';

export const CommerceProductImage = ({ product }: { product: CommerceProduct }) => {
  const image = product.images[0];

  return image ? (
    <img
      alt={image.altText ?? product.name}
      className="size-full object-cover"
      decoding="async"
      loading="lazy"
      sizes="(min-width: 1024px) 20vw, (min-width: 640px) 40vw, 90vw"
      src={resolveAssetUrl(image.url)}
    />
  ) : (
    <div className="bg-mist text-ink/25 grid size-full place-items-center">
      <span className="font-display text-5xl">A</span>
    </div>
  );
};
