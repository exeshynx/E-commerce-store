import type { RecommendationType } from '@aurelia/contracts';
import { useQuery } from '@tanstack/react-query';
import { ProductCard, ProductCardSkeleton } from './product-card';
import { discoveryApi, discoveryQueryKeys } from '../lib/discovery-api';

export const RecommendationSection = ({
  productId,
  title,
  type,
}: {
  productId?: string;
  title: string;
  type: RecommendationType;
}) => {
  const query = useQuery({
    enabled: type !== 'related' || Boolean(productId),
    queryFn: () => discoveryApi.getRecommendations(type, productId),
    queryKey: discoveryQueryKeys.recommendations(type, productId),
  });
  if (!query.isPending && !query.data?.items.length) return null;
  return (
    <section className="py-12" aria-labelledby={`recommendation-${type}`}>
      <div className="mb-7 flex items-end justify-between gap-4">
        <h2 className="font-display text-4xl" id={`recommendation-${type}`}>
          {title}
        </h2>
      </div>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {query.isPending
          ? Array.from({ length: 4 }, (_, index) => <ProductCardSkeleton key={index} />)
          : query.data?.items.map((product) => <ProductCard key={product.id} product={product} />)}
      </div>
    </section>
  );
};
