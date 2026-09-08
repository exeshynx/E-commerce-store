import { useQuery } from '@tanstack/react-query';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { OrderStatusBadge } from '../../components/order-status-badge';
import { getApiErrorMessage } from '../../lib/api-error';
import { adminApi, adminQueryKeys } from '../../lib/admin-api';
import { formatDate } from '../../lib/format-date';
import { formatPrice } from '../../lib/format-price';
import {
  AdminErrorState,
  AdminLoadingState,
  AdminPageHeader,
  AdminTable,
  AdminTableHead,
  StatCard,
} from '../components/admin-ui';

export const AdminDashboardPage = () => {
  const dashboard = useQuery({
    queryFn: adminApi.getDashboard,
    queryKey: adminQueryKeys.dashboard,
  });

  return (
    <>
      <Helmet>
        <title>Admin Dashboard — Veyora</title>
      </Helmet>
      <AdminPageHeader
        description="A concise operational view of customers, catalog health, inventory, and orders."
        eyebrow="Store overview"
        title="Dashboard"
      />
      <div className="mt-8">
        {dashboard.isPending ? <AdminLoadingState rows={6} /> : null}
        {dashboard.isError ? (
          <AdminErrorState
            message={getApiErrorMessage(dashboard.error)}
            retry={() => void dashboard.refetch()}
          />
        ) : null}
        {dashboard.data ? (
          <div className="space-y-8">
            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard label="Users" value={dashboard.data.metrics.totalUsers} />
              <StatCard
                hint={`${dashboard.data.metrics.activeProducts} active · ${dashboard.data.metrics.archivedProducts} archived`}
                label="Products"
                value={dashboard.data.metrics.totalProducts}
              />
              <StatCard label="Categories" value={dashboard.data.metrics.totalCategories} />
              <StatCard
                hint={`${dashboard.data.metrics.pendingOrders} pending`}
                label="Orders"
                value={dashboard.data.metrics.totalOrders}
              />
              <StatCard
                hint="Sellable quantity 1–5"
                label="Low stock"
                value={dashboard.data.metrics.lowStockProducts}
              />
              <StatCard label="Out of stock" value={dashboard.data.metrics.outOfStockProducts} />
              {dashboard.data.revenueByCurrency.length ? (
                dashboard.data.revenueByCurrency.map((revenue) => (
                  <StatCard
                    hint="Delivered orders only"
                    key={revenue.currency}
                    label={`Revenue · ${revenue.currency}`}
                    value={formatPrice(revenue.amount, revenue.currency)}
                  />
                ))
              ) : (
                <StatCard hint="Delivered orders only" label="Revenue" value="—" />
              )}
            </section>
            <section>
              <div className="mb-4 flex items-center justify-between gap-4">
                <h2 className="font-display text-3xl">Recent orders</h2>
                <Link className="text-sm font-semibold underline" to="/admin/orders">
                  View all
                </Link>
              </div>
              <AdminTable>
                <AdminTableHead>
                  <tr>
                    <th className="px-5 py-3">Order</th>
                    <th className="px-5 py-3">Customer</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3">Total</th>
                    <th className="px-5 py-3">Placed</th>
                  </tr>
                </AdminTableHead>
                <tbody className="divide-ink/10 divide-y">
                  {dashboard.data.recentOrders.map((order) => (
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
            </section>
          </div>
        ) : null}
      </div>
    </>
  );
};
