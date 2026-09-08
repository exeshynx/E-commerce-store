import type { ReturnStatus } from '@aurelia/contracts';
import { useQuery } from '@tanstack/react-query';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { ReturnStatusBadge } from '../../components/return-status-badge';
import { adminApi, adminQueryKeys, type AdminReturnListParameters } from '../../lib/admin-api';
import { getApiErrorMessage } from '../../lib/api-error';
import { formatDate } from '../../lib/format-date';
import { formatPrice } from '../../lib/format-price';
import {
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

const statuses: ReturnStatus[] = [
  'REQUESTED',
  'APPROVED',
  'REJECTED',
  'ITEM_RECEIVED',
  'INSPECTED',
  'REFUND_PENDING',
  'REFUNDED',
  'CLOSED',
];
const pageSize = 20;

export const AdminReturnsPage = () => {
  const filters = useAdminListFilters();
  const status = (filters.searchParams.get('status') || undefined) as ReturnStatus | undefined;
  const parameters: AdminReturnListParameters = {
    page: filters.page,
    pageSize,
    ...(filters.query ? { q: filters.query } : {}),
    ...(status ? { status } : {}),
  };
  const query = useQuery({
    queryFn: () => adminApi.listReturns(parameters),
    queryKey: adminQueryKeys.returns(parameters),
  });
  return (
    <>
      <Helmet>
        <title>Returns — Veyora Administration</title>
      </Helmet>
      <AdminPageHeader
        description="Review RMAs, partial return quantities, inspection progress, return tracking, and refund status."
        eyebrow="After-sales"
        title="Returns"
      />
      <div className="mt-8 flex flex-col gap-3 xl:flex-row">
        <AdminSearchBar
          onChange={filters.setSearch}
          onSubmit={() => filters.updateFilters({ q: filters.search.trim() || undefined })}
          placeholder="RMA, order, or customer email"
          value={filters.search}
        />
        <select
          className="border-ink/15 rounded-xl border bg-white px-4 py-2.5 text-sm"
          onChange={(event) => filters.updateFilters({ status: event.target.value || undefined })}
          value={status ?? ''}
        >
          <option value="">All statuses</option>
          {statuses.map((item) => (
            <option key={item} value={item}>
              {item.replaceAll('_', ' ')}
            </option>
          ))}
        </select>
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
            message="Customer return requests will appear here."
            title="No returns found"
          />
        ) : null}
        {query.data?.items.length ? (
          <div className="space-y-5">
            <AdminTable minWidth="65rem">
              <AdminTableHead>
                <tr>
                  <th className="px-5 py-3">Return</th>
                  <th className="px-5 py-3">Customer</th>
                  <th className="px-5 py-3">Order</th>
                  <th className="px-5 py-3">Items</th>
                  <th className="px-5 py-3">Refund value</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Requested</th>
                </tr>
              </AdminTableHead>
              <tbody className="divide-y">
                {query.data.items.map((item) => (
                  <tr key={item.id}>
                    <td className="px-5 py-4">
                      <Link
                        className="font-semibold hover:underline"
                        to={`/admin/returns/${item.id}`}
                      >
                        {item.returnNumber}
                      </Link>
                    </td>
                    <td className="px-5 py-4">
                      <p>
                        {item.customer?.firstName} {item.customer?.lastName}
                      </p>
                      <p className="text-ink/45 text-xs">{item.customer?.email}</p>
                    </td>
                    <td className="px-5 py-4">{item.order.orderNumber}</td>
                    <td className="px-5 py-4">
                      {item.items.reduce((sum, row) => sum + row.quantity, 0)}
                    </td>
                    <td className="px-5 py-4">
                      {formatPrice(
                        String(item.items.reduce((sum, row) => sum + Number(row.refundAmount), 0)),
                        item.items[0]?.currency ?? 'PKR',
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <ReturnStatusBadge status={item.status} />
                    </td>
                    <td className="px-5 py-4 text-sm">{formatDate(item.createdAt)}</td>
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
