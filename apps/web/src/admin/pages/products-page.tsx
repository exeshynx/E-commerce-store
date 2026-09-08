import type { AdminProductSummary } from '@veyora/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { FiPlus } from 'react-icons/fi';
import { toast } from 'sonner';
import { getApiErrorMessage } from '../../lib/api-error';
import {
  adminApi,
  adminQueryKeys,
  type ActivityFilter,
  type AdminProductListParameters,
} from '../../lib/admin-api';
import { resolveAssetUrl } from '../../lib/asset-url';
import { formatPrice } from '../../lib/format-price';
import { ProductEditor } from '../components/product-editor';
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
  ConfirmDialog,
} from '../components/admin-ui';
import { useAdminListFilters } from '../use-admin-list-filters';

const pageSize = 20;
const stockTone = (status: AdminProductSummary['inventory']['stockStatus']) =>
  status === 'IN_STOCK' ? 'good' : status === 'LOW_STOCK' ? 'warning' : 'danger';

export const AdminProductsPage = () => {
  const filters = useAdminListFilters();
  const queryClient = useQueryClient();
  const status = (filters.searchParams.get('status') || 'all') as ActivityFilter;
  const categoryId = filters.searchParams.get('categoryId') || undefined;
  const sort = (filters.searchParams.get('sort') || 'created_desc') as NonNullable<
    AdminProductListParameters['sort']
  >;
  const parameters: AdminProductListParameters = {
    page: filters.page,
    pageSize,
    sort,
    status,
    ...(categoryId ? { categoryId } : {}),
    ...(filters.query ? { q: filters.query } : {}),
  };
  const products = useQuery({
    queryFn: () => adminApi.listProducts(parameters),
    queryKey: adminQueryKeys.products(parameters),
  });
  const categories = useQuery({
    queryFn: () => adminApi.listCategories({ page: 1, pageSize: 100, status: 'all' }),
    queryKey: adminQueryKeys.categories({ page: 1, pageSize: 100, status: 'all' }),
  });
  const [editor, setEditor] = useState<string | null | undefined>(undefined);
  const [archiving, setArchiving] = useState<AdminProductSummary | null>(null);
  const invalidate = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['admin', 'products'] }),
      queryClient.invalidateQueries({ queryKey: ['catalog', 'products'] }),
      queryClient.invalidateQueries({ queryKey: adminQueryKeys.dashboard }),
    ]);
  const archive = useMutation({
    mutationFn: () => adminApi.archiveProduct(archiving?.id ?? ''),
    onSuccess: async () => {
      toast.success('Product archived.');
      setArchiving(null);
      await invalidate();
    },
  });
  const restore = useMutation({
    mutationFn: adminApi.restoreProduct,
    onSuccess: async () => {
      toast.success('Product restored.');
      await invalidate();
    },
  });
  return (
    <>
      <Helmet>
        <title>Products — Veyora Administration</title>
      </Helmet>
      <AdminPageHeader
        actions={
          <button
            className="bg-ink flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white"
            onClick={() => setEditor(null)}
            type="button"
          >
            <FiPlus /> New product
          </button>
        }
        description="Manage product identity, pricing, category, images, availability, and lifecycle."
        eyebrow="Catalog"
        title="Products"
      />
      <div className="mt-8 grid gap-3 xl:grid-cols-[minmax(18rem,1fr)_auto_auto_auto]">
        <AdminSearchBar
          onChange={filters.setSearch}
          onSubmit={() => filters.updateFilters({ q: filters.search.trim() || undefined })}
          placeholder="Search product, SKU, or slug"
          value={filters.search}
        />
        <select
          aria-label="Filter product status"
          className="border-ink/15 rounded-xl border bg-white px-4 py-2.5 text-sm"
          onChange={(event) => filters.updateFilters({ status: event.target.value })}
          value={status}
        >
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="archived">Archived</option>
        </select>
        <select
          aria-label="Filter product category"
          className="border-ink/15 rounded-xl border bg-white px-4 py-2.5 text-sm"
          onChange={(event) =>
            filters.updateFilters({ categoryId: event.target.value || undefined })
          }
          value={categoryId ?? ''}
        >
          <option value="">All categories</option>
          {categories.data?.items.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
        <select
          aria-label="Sort products"
          className="border-ink/15 rounded-xl border bg-white px-4 py-2.5 text-sm"
          onChange={(event) => filters.updateFilters({ sort: event.target.value })}
          value={sort}
        >
          <option value="created_desc">Newest</option>
          <option value="created_asc">Oldest</option>
          <option value="name_asc">Name A–Z</option>
          <option value="name_desc">Name Z–A</option>
          <option value="price_desc">Highest price</option>
          <option value="price_asc">Lowest price</option>
        </select>
      </div>
      <div className="mt-6">
        {products.isPending ? <AdminLoadingState /> : null}
        {products.isError ? (
          <AdminErrorState
            message={getApiErrorMessage(products.error)}
            retry={() => void products.refetch()}
          />
        ) : null}
        {products.data?.items.length === 0 ? (
          <AdminEmptyState
            message="Create a product or adjust your filters."
            title="No products found"
          />
        ) : null}
        {products.data?.items.length ? (
          <div className="space-y-5">
            <AdminTable minWidth="68rem">
              <AdminTableHead>
                <tr>
                  <th className="px-5 py-3">Product</th>
                  <th className="px-5 py-3">Category</th>
                  <th className="px-5 py-3">Price</th>
                  <th className="px-5 py-3">Inventory</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Actions</th>
                </tr>
              </AdminTableHead>
              <tbody className="divide-ink/10 divide-y">
                {products.data.items.map((product) => (
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
                          <div className="bg-mist font-display grid size-12 place-items-center rounded-lg">
                            A
                          </div>
                        )}
                        <div>
                          <p className="font-semibold">{product.name}</p>
                          <p className="text-ink/45 text-xs">{product.sku}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">{product.category.name}</td>
                    <td className="px-5 py-4 font-semibold">
                      {formatPrice(product.price, product.currency)}
                    </td>
                    <td className="px-5 py-4">
                      <AdminBadge tone={stockTone(product.inventory.stockStatus)}>
                        {product.inventory.availableQuantity} sellable
                      </AdminBadge>
                    </td>
                    <td className="px-5 py-4">
                      <AdminBadge tone={product.isActive ? 'good' : 'neutral'}>
                        {product.isActive ? 'Active' : 'Archived'}
                      </AdminBadge>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex gap-3">
                        <button
                          className="font-semibold underline"
                          onClick={() => setEditor(product.id)}
                          type="button"
                        >
                          Edit
                        </button>
                        {product.isActive ? (
                          <button
                            className="font-semibold text-red-700 underline"
                            onClick={() => setArchiving(product)}
                            type="button"
                          >
                            Archive
                          </button>
                        ) : (
                          <button
                            className="font-semibold text-emerald-700 underline"
                            disabled={restore.isPending}
                            onClick={() => restore.mutate(product.id)}
                            type="button"
                          >
                            Restore
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </AdminTable>
            <AdminPagination
              isFetching={products.isFetching}
              onPageChange={(page) => filters.updateFilters({ page: String(page) })}
              page={products.data.pagination.page}
              totalPages={products.data.pagination.totalPages}
            />
          </div>
        ) : null}
      </div>
      {editor !== undefined && categories.data ? (
        <ProductEditor
          categories={categories.data.items}
          onClose={() => setEditor(undefined)}
          productId={editor}
        />
      ) : null}
      {archiving ? (
        <ConfirmDialog
          confirmLabel="Archive product"
          description={`Archive ${archiving.name}? Existing carts and wishlists will retain it as unavailable, while historical orders remain unchanged.`}
          isPending={archive.isPending}
          onCancel={() => setArchiving(null)}
          onConfirm={() => archive.mutate()}
          title="Archive product"
        />
      ) : null}
    </>
  );
};
