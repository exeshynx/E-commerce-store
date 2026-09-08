import type { AdminAuditAction, AdminAuditEntityType } from '@aurelia/contracts';
import { useQuery } from '@tanstack/react-query';
import { Helmet } from 'react-helmet-async';
import { adminApi, adminQueryKeys, type AdminAuditListParameters } from '../../lib/admin-api';
import { getApiErrorMessage } from '../../lib/api-error';
import { formatDate } from '../../lib/format-date';
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
  AdminVirtualizedList,
} from '../components/admin-ui';
import { useAdminListFilters } from '../use-admin-list-filters';

const actions: AdminAuditAction[] = [
  'ADMIN_LOGIN',
  'PRODUCT_CREATED',
  'PRODUCT_UPDATED',
  'PRODUCT_ARCHIVED',
  'PRODUCT_RESTORED',
  'PRODUCT_IMAGE_ADDED',
  'PRODUCT_IMAGE_UPDATED',
  'PRODUCT_IMAGE_REMOVED',
  'CATEGORY_CREATED',
  'CATEGORY_UPDATED',
  'CATEGORY_ARCHIVED',
  'CATEGORY_RESTORED',
  'INVENTORY_UPDATED',
  'PAYMENT_REFUND_CREATED',
  'SHIPMENT_CREATED',
  'SHIPMENT_UPDATED',
  'SHIPMENT_STATUS_CHANGED',
  'RETURN_APPROVED',
  'RETURN_REJECTED',
  'RETURN_ITEM_RECEIVED',
  'RETURN_INSPECTED',
  'RETURN_REFUND_INITIATED',
  'RETURN_CLOSED',
  'RETURN_SHIPMENT_UPDATED',
  'RETURN_SHIPMENT_STATUS_CHANGED',
  'SUPPORT_TICKET_REPLIED',
  'SUPPORT_TICKET_ASSIGNED',
  'SUPPORT_TICKET_PRIORITY_CHANGED',
  'SUPPORT_TICKET_STATUS_CHANGED',
  'REVIEW_APPROVED',
  'REVIEW_REJECTED',
  'REVIEW_DELETED',
  'REVIEW_RESTORED',
  'COUPON_CREATED',
  'COUPON_UPDATED',
  'COUPON_ENABLED',
  'COUPON_DISABLED',
  'PRODUCT_FEATURED',
  'PRODUCT_UNFEATURED',
];
const entityTypes: AdminAuditEntityType[] = [
  'USER',
  'PRODUCT',
  'CATEGORY',
  'INVENTORY',
  'PAYMENT_REFUND',
  'SHIPMENT',
  'RETURN_REQUEST',
  'RETURN_SHIPMENT',
  'SUPPORT_TICKET',
  'REVIEW',
  'COUPON',
];
const pageSize = 25;

const metadataSummary = (metadata: unknown) => {
  if (!metadata || typeof metadata !== 'object') return '—';
  const value = JSON.stringify(metadata);
  return value.length > 140 ? `${value.slice(0, 137)}…` : value;
};

export const AdminAuditPage = () => {
  const filters = useAdminListFilters();
  const action = (filters.searchParams.get('action') || undefined) as AdminAuditAction | undefined;
  const entityType = (filters.searchParams.get('entityType') || undefined) as
    AdminAuditEntityType | undefined;
  const parameters: AdminAuditListParameters = {
    page: filters.page,
    pageSize,
    ...(action ? { action } : {}),
    ...(entityType ? { entityType } : {}),
    ...(filters.query ? { q: filters.query } : {}),
  };
  const audit = useQuery({
    queryFn: () => adminApi.listAudit(parameters),
    queryKey: adminQueryKeys.audit(parameters),
  });
  return (
    <>
      <Helmet>
        <title>Administrator audit — Veyora Administration</title>
      </Helmet>
      <AdminPageHeader
        description="Review append-only records of sensitive administrator actions and their request identifiers."
        eyebrow="Security and accountability"
        title="Administrator audit"
      />
      <div className="mt-8 flex flex-col gap-3 xl:flex-row">
        <AdminSearchBar
          onChange={filters.setSearch}
          onSubmit={() => filters.updateFilters({ q: filters.search.trim() || undefined })}
          placeholder="Administrator or entity ID"
          value={filters.search}
        />
        <select
          aria-label="Filter audit action"
          className="border-ink/15 rounded-xl border bg-white px-4 py-2.5 text-sm"
          onChange={(event) => filters.updateFilters({ action: event.target.value || undefined })}
          value={action ?? ''}
        >
          <option value="">All actions</option>
          {actions.map((item) => (
            <option key={item} value={item}>
              {item.replaceAll('_', ' ')}
            </option>
          ))}
        </select>
        <select
          aria-label="Filter audit entity"
          className="border-ink/15 rounded-xl border bg-white px-4 py-2.5 text-sm"
          onChange={(event) =>
            filters.updateFilters({ entityType: event.target.value || undefined })
          }
          value={entityType ?? ''}
        >
          <option value="">All entities</option>
          {entityTypes.map((item) => (
            <option key={item} value={item}>
              {item.replaceAll('_', ' ')}
            </option>
          ))}
        </select>
      </div>
      <div className="mt-6">
        {audit.isPending ? <AdminLoadingState /> : null}
        {audit.isError ? (
          <AdminErrorState
            message={getApiErrorMessage(audit.error)}
            retry={() => void audit.refetch()}
          />
        ) : null}
        {audit.data?.items.length === 0 ? (
          <AdminEmptyState
            message="Sensitive administrator operations will appear here."
            title="No audit records found"
          />
        ) : null}
        {audit.data?.items.length ? (
          <div className="space-y-5">
            <div className="lg:hidden">
              <AdminVirtualizedList
                ariaLabel="Administrator audit entries"
                items={audit.data.items}
                renderItem={(entry) => (
                  <article className="border-ink/10 rounded-2xl border bg-white p-5 shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <AdminBadge>{entry.action.replaceAll('_', ' ')}</AdminBadge>
                      <time className="text-ink/50 text-xs" dateTime={entry.createdAt}>
                        {formatDate(entry.createdAt)}
                      </time>
                    </div>
                    <p className="mt-4 font-semibold">
                      {entry.administrator.firstName} {entry.administrator.lastName}
                    </p>
                    <p className="text-ink/45 text-xs">{entry.administrator.email}</p>
                    <p className="text-ink/60 mt-3 text-sm break-words">
                      {entry.entityType.replaceAll('_', ' ')}: {entry.entityId}
                    </p>
                    <p className="text-ink/50 mt-2 font-mono text-xs break-words">
                      {metadataSummary(entry.metadata)}
                    </p>
                  </article>
                )}
              />
            </div>
            <div className="hidden lg:block">
              <AdminTable ariaLabel="Administrator audit entries" minWidth="70rem">
                <AdminTableHead>
                  <tr>
                    <th className="px-5 py-3">Action</th>
                    <th className="px-5 py-3">Administrator</th>
                    <th className="px-5 py-3">Entity</th>
                    <th className="px-5 py-3">Details</th>
                    <th className="px-5 py-3">Request ID</th>
                    <th className="px-5 py-3">Time</th>
                  </tr>
                </AdminTableHead>
                <tbody className="divide-ink/10 divide-y">
                  {audit.data.items.map((entry) => (
                    <tr key={entry.id}>
                      <td className="px-5 py-4">
                        <AdminBadge>{entry.action.replaceAll('_', ' ')}</AdminBadge>
                      </td>
                      <td className="px-5 py-4">
                        <p className="font-semibold">
                          {entry.administrator.firstName} {entry.administrator.lastName}
                        </p>
                        <p className="text-ink/45 text-xs">{entry.administrator.email}</p>
                      </td>
                      <td className="px-5 py-4">
                        <p className="font-semibold">{entry.entityType.replaceAll('_', ' ')}</p>
                        <p
                          className="text-ink/40 mt-1 max-w-48 truncate text-xs"
                          title={entry.entityId}
                        >
                          {entry.entityId}
                        </p>
                      </td>
                      <td
                        className="text-ink/55 max-w-72 px-5 py-4 font-mono text-xs"
                        title={metadataSummary(entry.metadata)}
                      >
                        {metadataSummary(entry.metadata)}
                      </td>
                      <td
                        className="text-ink/45 max-w-48 truncate px-5 py-4 font-mono text-xs"
                        title={entry.requestId ?? undefined}
                      >
                        {entry.requestId ?? '—'}
                      </td>
                      <td className="text-ink/55 px-5 py-4">{formatDate(entry.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </AdminTable>
            </div>
            <AdminPagination
              isFetching={audit.isFetching}
              onPageChange={(page) => filters.updateFilters({ page: String(page) })}
              page={audit.data.pagination.page}
              totalPages={audit.data.pagination.totalPages}
            />
          </div>
        ) : null}
      </div>
    </>
  );
};
