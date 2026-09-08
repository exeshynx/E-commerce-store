import type { AdminInventoryItem } from '@veyora/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { toast } from 'sonner';
import { getApiErrorMessage } from '../../lib/api-error';
import { adminApi, adminQueryKeys, type AdminInventoryListParameters } from '../../lib/admin-api';
import { formatDate } from '../../lib/format-date';
import {
  AdminBadge,
  AdminEmptyState,
  AdminErrorState,
  AdminLoadingState,
  AdminModal,
  AdminPageHeader,
  AdminPagination,
  AdminSearchBar,
  AdminTable,
  AdminTableHead,
} from '../components/admin-ui';
import { useAdminListFilters } from '../use-admin-list-filters';

const pageSize = 20;
const stockTone = (status: AdminInventoryItem['inventory']['stockStatus']) =>
  status === 'IN_STOCK' ? 'good' : status === 'LOW_STOCK' ? 'warning' : 'danger';

export const AdminInventoryPage = () => {
  const filters = useAdminListFilters();
  const queryClient = useQueryClient();
  const stock = (filters.searchParams.get('stock') || 'all') as NonNullable<
    AdminInventoryListParameters['stock']
  >;
  const parameters: AdminInventoryListParameters = {
    page: filters.page,
    pageSize,
    stock,
    ...(filters.query ? { q: filters.query } : {}),
  };
  const inventory = useQuery({
    queryFn: () => adminApi.listInventory(parameters),
    queryKey: adminQueryKeys.inventory(parameters),
  });
  const [editing, setEditing] = useState<AdminInventoryItem | null>(null);
  const [totalQuantity, setTotalQuantity] = useState('0');
  const updateInventory = useMutation({
    mutationFn: () =>
      adminApi.updateInventory(editing?.id ?? '', { totalQuantity: Number(totalQuantity) }),
    onSuccess: async () => {
      toast.success('Inventory updated.');
      setEditing(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin', 'inventory'] }),
        queryClient.invalidateQueries({ queryKey: ['admin', 'products'] }),
        queryClient.invalidateQueries({ queryKey: adminQueryKeys.dashboard }),
      ]);
    },
  });
  const openEditor = (item: AdminInventoryItem) => {
    setEditing(item);
    setTotalQuantity(String(item.inventory.totalQuantity));
    updateInventory.reset();
  };
  return (
    <>
      <Helmet>
        <title>Inventory — Veyora Administration</title>
      </Helmet>
      <AdminPageHeader
        description="Manage on-hand stock while preserving reserved quantities and clear sellable-stock indicators."
        eyebrow="Catalog operations"
        title="Inventory"
      />
      <div className="mt-8 flex flex-col gap-3 lg:flex-row">
        <AdminSearchBar
          onChange={filters.setSearch}
          onSubmit={() => filters.updateFilters({ q: filters.search.trim() || undefined })}
          placeholder="Search product or SKU"
          value={filters.search}
        />
        <select
          aria-label="Filter stock"
          className="border-ink/15 rounded-xl border bg-white px-4 py-2.5 text-sm"
          onChange={(event) => filters.updateFilters({ stock: event.target.value })}
          value={stock}
        >
          <option value="all">All stock</option>
          <option value="in_stock">In stock</option>
          <option value="low_stock">Low stock</option>
          <option value="out_of_stock">Out of stock</option>
        </select>
      </div>
      <div className="mt-6">
        {inventory.isPending ? <AdminLoadingState /> : null}
        {inventory.isError ? (
          <AdminErrorState
            message={getApiErrorMessage(inventory.error)}
            retry={() => void inventory.refetch()}
          />
        ) : null}
        {inventory.data?.items.length === 0 ? (
          <AdminEmptyState
            message="Try another stock filter or search."
            title="No inventory found"
          />
        ) : null}
        {inventory.data?.items.length ? (
          <div className="space-y-5">
            <AdminTable>
              <AdminTableHead>
                <tr>
                  <th className="px-5 py-3">Product</th>
                  <th className="px-5 py-3">Sellable</th>
                  <th className="px-5 py-3">Reserved</th>
                  <th className="px-5 py-3">Total</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Updated</th>
                  <th className="px-5 py-3">Action</th>
                </tr>
              </AdminTableHead>
              <tbody className="divide-ink/10 divide-y">
                {inventory.data.items.map((item) => (
                  <tr key={item.id}>
                    <td className="px-5 py-4">
                      <p className="font-semibold">{item.name}</p>
                      <p className="text-ink/45 text-xs">
                        {item.sku} {!item.isActive ? '· archived' : ''}
                      </p>
                    </td>
                    <td className="px-5 py-4 font-semibold">{item.inventory.availableQuantity}</td>
                    <td className="px-5 py-4">{item.inventory.reservedQuantity}</td>
                    <td className="px-5 py-4">{item.inventory.totalQuantity}</td>
                    <td className="px-5 py-4">
                      <AdminBadge tone={stockTone(item.inventory.stockStatus)}>
                        {item.inventory.stockStatus.replaceAll('_', ' ')}
                      </AdminBadge>
                    </td>
                    <td className="text-ink/50 px-5 py-4">
                      {item.inventory.updatedAt ? formatDate(item.inventory.updatedAt) : '—'}
                    </td>
                    <td className="px-5 py-4">
                      <button
                        className="font-semibold underline"
                        onClick={() => openEditor(item)}
                        type="button"
                      >
                        Update
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </AdminTable>
            <AdminPagination
              isFetching={inventory.isFetching}
              onPageChange={(page) => filters.updateFilters({ page: String(page) })}
              page={inventory.data.pagination.page}
              totalPages={inventory.data.pagination.totalPages}
            />
          </div>
        ) : null}
      </div>
      {editing ? (
        <AdminModal onClose={() => setEditing(null)} title={`Update ${editing.name}`}>
          <p className="text-ink/55 text-sm">
            Reserved stock: {editing.inventory.reservedQuantity}. Total stock cannot be lower than
            this value.
          </p>
          <label className="mt-5 block text-sm font-semibold">
            Total on-hand quantity
            <input
              className="border-ink/15 mt-2 w-full rounded-xl border px-4 py-3"
              min={editing.inventory.reservedQuantity}
              onChange={(event) => setTotalQuantity(event.target.value)}
              step="1"
              type="number"
              value={totalQuantity}
            />
          </label>
          {updateInventory.isError ? (
            <p className="mt-3 text-sm text-red-700" role="alert">
              {getApiErrorMessage(updateInventory.error)}
            </p>
          ) : null}
          <div className="mt-6 flex justify-end gap-3">
            <button
              className="border-ink/15 rounded-xl border px-4 py-2"
              onClick={() => setEditing(null)}
              type="button"
            >
              Cancel
            </button>
            <button
              className="bg-ink rounded-xl px-4 py-2 font-semibold text-white disabled:opacity-40"
              disabled={
                updateInventory.isPending ||
                !Number.isInteger(Number(totalQuantity)) ||
                Number(totalQuantity) < 0
              }
              onClick={() => updateInventory.mutate()}
              type="button"
            >
              {updateInventory.isPending ? 'Saving…' : 'Save inventory'}
            </button>
          </div>
        </AdminModal>
      ) : null}
    </>
  );
};
