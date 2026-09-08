import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Helmet } from 'react-helmet-async';
import { toast } from 'sonner';
import { adminApi, adminQueryKeys, type AdminProductListParameters } from '../../lib/admin-api';
import { getApiErrorMessage } from '../../lib/api-error';
import { resolveAssetUrl } from '../../lib/asset-url';
import {
  AdminBadge,
  AdminEmptyState,
  AdminErrorState,
  AdminLoadingState,
  AdminPageHeader,
  AdminPagination,
  AdminSearchBar,
  AdminTable,
  AdminTableHead,
} from '../components/admin-ui';
import { useAdminListFilters } from '../use-admin-list-filters';

export const AdminFeaturedProductsPage = () => {
  const filters = useAdminListFilters();
  const queryClient = useQueryClient();
  const parameters: AdminProductListParameters = {
    page: filters.page,
    pageSize: 20,
    status: 'active',
    ...(filters.query ? { q: filters.query } : {}),
  };
  const query = useQuery({
    queryFn: () => adminApi.listProducts(parameters),
    queryKey: adminQueryKeys.products(parameters),
  });
  const toggle = useMutation({
    mutationFn: ({ id, isFeatured }: { id: string; isFeatured: boolean }) =>
      adminApi.setProductFeatured(id, isFeatured),
    onSuccess: async (product) => {
      toast.success(product.isFeatured ? 'Product featured.' : 'Product removed from featured.');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin', 'products'] }),
        queryClient.invalidateQueries({ queryKey: ['discovery', 'recommendations', 'featured'] }),
      ]);
    },
  });
  return (
    <>
      <Helmet>
        <title>Featured products — Veyora Administration</title>
      </Helmet>
      <AdminPageHeader
        description="Curate products shown in featured storefront recommendations."
        eyebrow="Discovery"
        title="Featured products"
      />
      <div className="mt-8">
        <AdminSearchBar
          onChange={filters.setSearch}
          onSubmit={() => filters.updateFilters({ q: filters.search.trim() || undefined })}
          placeholder="Search active products"
          value={filters.search}
        />
      </div>
      <div className="mt-6">
        {query.isPending ? <AdminLoadingState /> : null}
        {query.isError ? (
          <AdminErrorState
            message={getApiErrorMessage(query.error)}
            retry={() => void query.refetch()}
          />
        ) : null}
        {query.data?.items.length === 0 ? (
          <AdminEmptyState
            title="No products found"
            message="Add active products before curating featured items."
          />
        ) : null}
        {query.data?.items.length ? (
          <div className="space-y-5">
            <AdminTable>
              <AdminTableHead>
                <tr>
                  <th className="px-5 py-3">Product</th>
                  <th className="px-5 py-3">Category</th>
                  <th className="px-5 py-3">Stock</th>
                  <th className="px-5 py-3">Featured</th>
                  <th className="px-5 py-3">Action</th>
                </tr>
              </AdminTableHead>
              <tbody className="divide-y">
                {query.data.items.map((product) => (
                  <tr key={product.id}>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        {product.image ? (
                          <img
                            alt={product.image.altText ?? product.name}
                            className="size-12 rounded-lg object-cover"
                            decoding="async"
                            loading="lazy"
                            src={resolveAssetUrl(product.image.url)}
                          />
                        ) : (
                          <div className="bg-mist size-12 rounded-lg" />
                        )}
                        <div>
                          <p className="font-semibold">{product.name}</p>
                          <p className="text-ink/45 text-xs">{product.sku}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">{product.category.name}</td>
                    <td className="px-5 py-4">{product.inventory.availableQuantity}</td>
                    <td className="px-5 py-4">
                      <AdminBadge tone={product.isFeatured ? 'good' : 'neutral'}>
                        {product.isFeatured ? 'Featured' : 'Standard'}
                      </AdminBadge>
                    </td>
                    <td className="px-5 py-4">
                      <button
                        className="font-semibold underline"
                        disabled={toggle.isPending}
                        onClick={() =>
                          toggle.mutate({ id: product.id, isFeatured: !product.isFeatured })
                        }
                      >
                        {product.isFeatured ? 'Remove' : 'Feature'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </AdminTable>
            <AdminPagination
              isFetching={query.isFetching}
              onPageChange={(page) => filters.updateFilters({ page: String(page) })}
              page={query.data.pagination.page}
              totalPages={query.data.pagination.totalPages}
            />
          </div>
        ) : null}
      </div>
    </>
  );
};
