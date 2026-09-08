import type { ShipmentStatus } from '@aurelia/contracts';
import { useQuery } from '@tanstack/react-query';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { ShipmentStatusBadge } from '../../components/shipment-status-badge';
import { adminApi, adminQueryKeys, type AdminShipmentListParameters } from '../../lib/admin-api';
import { getApiErrorMessage } from '../../lib/api-error';
import { formatDate } from '../../lib/format-date';
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
const statuses: ShipmentStatus[] = [
  'PACKING',
  'READY_TO_SHIP',
  'SHIPPED',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'RETURNED',
];

export const AdminShipmentsPage = () => {
  const filters = useAdminListFilters();
  const status = (filters.searchParams.get('status') || undefined) as ShipmentStatus | undefined;
  const parameters: AdminShipmentListParameters = {
    page: filters.page,
    pageSize,
    ...(filters.query ? { q: filters.query } : {}),
    ...(status ? { status } : {}),
  };
  const shipments = useQuery({
    queryFn: () => adminApi.listShipments(parameters),
    queryKey: adminQueryKeys.shipments(parameters),
  });

  return (
    <>
      <Helmet>
        <title>Shipments — Veyora Administration</title>
      </Helmet>
      <AdminPageHeader
        description="Manage courier assignments, tracking numbers, and immutable fulfillment timelines."
        eyebrow="Fulfillment"
        title="Shipments"
      />
      <div className="mt-8 flex flex-col gap-3 xl:flex-row">
        <AdminSearchBar
          onChange={filters.setSearch}
          onSubmit={() => filters.updateFilters({ q: filters.search.trim() || undefined })}
          placeholder="Order, customer, courier, or tracking number"
          value={filters.search}
        />
        <select
          aria-label="Filter shipment status"
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
        {shipments.isPending ? <AdminLoadingState /> : null}
        {shipments.isError ? (
          <AdminErrorState
            message={getApiErrorMessage(shipments.error)}
            retry={() => void shipments.refetch()}
          />
        ) : null}
        {shipments.data?.items.length === 0 ? (
          <AdminEmptyState
            message="Create a shipment from a processing order, or adjust the current filters."
            title="No shipments found"
          />
        ) : null}
        {shipments.data?.items.length ? (
          <div className="space-y-5">
            <AdminTable>
              <AdminTableHead>
                <tr>
                  <th className="px-5 py-3">Order</th>
                  <th className="px-5 py-3">Customer</th>
                  <th className="px-5 py-3">Courier</th>
                  <th className="px-5 py-3">Tracking</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Updated</th>
                </tr>
              </AdminTableHead>
              <tbody className="divide-ink/10 divide-y">
                {shipments.data.items.map((shipment) => (
                  <tr key={shipment.id}>
                    <td className="px-5 py-4">
                      <Link
                        className="font-semibold hover:underline"
                        to={`/admin/shipments/${shipment.id}`}
                      >
                        {shipment.order.orderNumber}
                      </Link>
                    </td>
                    <td className="px-5 py-4">
                      <p>
                        {shipment.order.user.firstName} {shipment.order.user.lastName}
                      </p>
                      <p className="text-ink/45 text-xs">{shipment.order.user.email}</p>
                    </td>
                    <td className="px-5 py-4">{shipment.courier}</td>
                    <td className="text-ink/55 px-5 py-4">
                      {shipment.trackingNumber ?? 'Pending'}
                    </td>
                    <td className="px-5 py-4">
                      <ShipmentStatusBadge status={shipment.status} />
                    </td>
                    <td className="text-ink/55 px-5 py-4">{formatDate(shipment.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </AdminTable>
            <AdminPagination
              isFetching={shipments.isFetching}
              onPageChange={(page) => filters.updateFilters({ page: String(page) })}
              page={shipments.data.pagination.page}
              totalPages={shipments.data.pagination.totalPages}
            />
          </div>
        ) : null}
      </div>
    </>
  );
};
