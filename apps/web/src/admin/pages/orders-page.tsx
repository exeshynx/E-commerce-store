import type { OrderStatus } from '@aurelia/contracts';
import { useQuery } from '@tanstack/react-query';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { OrderStatusBadge } from '../../components/order-status-badge';
import { getApiErrorMessage } from '../../lib/api-error';
import { adminApi, adminQueryKeys, type AdminOrderListParameters } from '../../lib/admin-api';
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

const pageSize = 20;
const statuses: OrderStatus[] = [
  'PENDING',
  'AWAITING_PAYMENT',
  'PROCESSING',
  'SHIPPED',
  'DELIVERED',
  'CANCELLED',
];

export const AdminOrdersPage = () => {
  const filters = useAdminListFilters();
  const status = (filters.searchParams.get('status') || undefined) as OrderStatus | undefined;
  const sort = (filters.searchParams.get('sort') || 'created_desc') as NonNullable<
    AdminOrderListParameters['sort']
  >;
  const parameters: AdminOrderListParameters = {
    page: filters.page,
    pageSize,
    sort,
    ...(filters.query ? { q: filters.query } : {}),
    ...(status ? { status } : {}),
  };
  const orders = useQuery({
    queryFn: () => adminApi.listOrders(parameters),
    queryKey: adminQueryKeys.orders(parameters),
  });
  return (
    <>
      <Helmet>
        <title>Orders — Veyora Administration</title>
      </Helmet>
      <AdminPageHeader
        description="Search every order, inspect immutable checkout details, and manage fulfillment state."
        eyebrow="Fulfillment"
        title="Orders"
      />
      <div className="mt-8 flex flex-col gap-3 xl:flex-row">
        <AdminSearchBar
          onChange={filters.setSearch}
          onSubmit={() => filters.updateFilters({ q: filters.search.trim() || undefined })}
          placeholder="Order number, customer, or email"
          value={filters.search}
        />
        <select
          aria-label="Filter order status"
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
        <select
          aria-label="Sort orders"
          className="border-ink/15 rounded-xl border bg-white px-4 py-2.5 text-sm"
          onChange={(event) => filters.updateFilters({ sort: event.target.value })}
          value={sort}
        >
          <option value="created_desc">Newest first</option>
          <option value="created_asc">Oldest first</option>
          <option value="total_desc">Highest total</option>
          <option value="total_asc">Lowest total</option>
        </select>
      </div>
      <div className="mt-6">
        {orders.isPending ? <AdminLoadingState /> : null}
        {orders.isError ? (
          <AdminErrorState
            message={getApiErrorMessage(orders.error)}
            retry={() => void orders.refetch()}
          />
        ) : null}
        {orders.data?.items.length === 0 ? (
          <AdminEmptyState message="Try another search or status filter." title="No orders found" />
        ) : null}
        {orders.data?.items.length ? (
          <div className="space-y-5">
            <AdminTable>
              <AdminTableHead>
                <tr>
                  <th className="px-5 py-3">Order</th>
                  <th className="px-5 py-3">Customer</th>
                  <th className="px-5 py-3">Items</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Total</th>
                  <th className="px-5 py-3">Placed</th>
                </tr>
              </AdminTableHead>
              <tbody className="divide-ink/10 divide-y">
                {orders.data.items.map((order) => (
                  <tr key={order.id}>
                    <td className="px-5 py-4">
                      <Link
                        className="font-semibold hover:underline"
                        to={`/admin/orders/${order.id}`}
                      >
                        {order.orderNumber}
                      </Link>
                    </td>
                    <td className="px-5 py-4">
                      <p>
                        {order.customer.firstName} {order.customer.lastName}
                      </p>
                      <p className="text-ink/45 text-xs">{order.customer.email}</p>
                    </td>
                    <td className="px-5 py-4">{order.itemCount}</td>
                    <td className="px-5 py-4">
                      <OrderStatusBadge status={order.status} />
                    </td>
                    <td className="px-5 py-4 font-semibold">
                      {formatPrice(order.total, order.currency)}
                    </td>
                    <td className="text-ink/55 px-5 py-4">{formatDate(order.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </AdminTable>
            <AdminPagination
              isFetching={orders.isFetching}
              onPageChange={(page) => filters.updateFilters({ page: String(page) })}
              page={orders.data.pagination.page}
              totalPages={orders.data.pagination.totalPages}
            />
          </div>
        ) : null}
      </div>
    </>
  );
};
