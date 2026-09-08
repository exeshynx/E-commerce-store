import type { SupportTicketPriority, SupportTicketStatus } from '@veyora/contracts';
import { useQuery } from '@tanstack/react-query';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { SupportStatusBadge } from '../../components/support-status-badge';
import { adminApi, adminQueryKeys, type AdminSupportListParameters } from '../../lib/admin-api';
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
} from '../components/admin-ui';
import { useAdminListFilters } from '../use-admin-list-filters';

const statuses: SupportTicketStatus[] = [
  'OPEN',
  'IN_PROGRESS',
  'WAITING_CUSTOMER',
  'RESOLVED',
  'CLOSED',
];
const priorities: SupportTicketPriority[] = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];

export const AdminSupportPage = () => {
  const filters = useAdminListFilters();
  const status = (filters.searchParams.get('status') || undefined) as
    SupportTicketStatus | undefined;
  const priority = (filters.searchParams.get('priority') || undefined) as
    SupportTicketPriority | undefined;
  const parameters: AdminSupportListParameters = {
    page: filters.page,
    pageSize: 20,
    ...(filters.query ? { q: filters.query } : {}),
    ...(status ? { status } : {}),
    ...(priority ? { priority } : {}),
  };
  const query = useQuery({
    queryFn: () => adminApi.listSupportTickets(parameters),
    queryKey: adminQueryKeys.supportTickets(parameters),
  });
  return (
    <>
      <Helmet>
        <title>Support — Veyora Administration</title>
      </Helmet>
      <AdminPageHeader
        description="Manage customer conversations, assignment, priority, and resolution without losing message history."
        eyebrow="Customer service"
        title="Support"
      />
      <div className="mt-8 flex flex-col gap-3 xl:flex-row">
        <AdminSearchBar
          onChange={filters.setSearch}
          onSubmit={() => filters.updateFilters({ q: filters.search.trim() || undefined })}
          placeholder="Ticket, subject, order, or customer"
          value={filters.search}
        />
        <select
          className="rounded-xl border bg-white px-4 py-2.5 text-sm"
          onChange={(event) => filters.updateFilters({ status: event.target.value || undefined })}
          value={status ?? ''}
        >
          <option value="">All statuses</option>
          {statuses.map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
        <select
          className="rounded-xl border bg-white px-4 py-2.5 text-sm"
          onChange={(event) => filters.updateFilters({ priority: event.target.value || undefined })}
          value={priority ?? ''}
        >
          <option value="">All priorities</option>
          {priorities.map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
      </div>
      <div className="mt-6">
        {query.isPending ? <AdminLoadingState /> : null}
        {query.isError ? <AdminErrorState message={getApiErrorMessage(query.error)} /> : null}
        {query.data?.items.length === 0 ? (
          <AdminEmptyState
            message="Customer support requests will appear here."
            title="No tickets found"
          />
        ) : null}
        {query.data?.items.length ? (
          <div className="space-y-5">
            <AdminTable minWidth="65rem">
              <AdminTableHead>
                <tr>
                  <th className="px-5 py-3">Ticket</th>
                  <th className="px-5 py-3">Customer</th>
                  <th className="px-5 py-3">Priority</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Assigned</th>
                  <th className="px-5 py-3">Messages</th>
                  <th className="px-5 py-3">Updated</th>
                </tr>
              </AdminTableHead>
              <tbody className="divide-y">
                {query.data.items.map((ticket) => (
                  <tr key={ticket.id}>
                    <td className="px-5 py-4">
                      <Link
                        className="font-semibold hover:underline"
                        to={`/admin/support/${ticket.id}`}
                      >
                        {ticket.subject}
                      </Link>
                      <p className="text-ink/45 text-xs">{ticket.ticketNumber}</p>
                    </td>
                    <td className="px-5 py-4">
                      <p>
                        {ticket.customer?.firstName} {ticket.customer?.lastName}
                      </p>
                      <p className="text-ink/45 text-xs">{ticket.customer?.email}</p>
                    </td>
                    <td className="px-5 py-4">
                      <AdminBadge
                        tone={
                          ticket.priority === 'URGENT'
                            ? 'danger'
                            : ticket.priority === 'HIGH'
                              ? 'warning'
                              : 'neutral'
                        }
                      >
                        {ticket.priority}
                      </AdminBadge>
                    </td>
                    <td className="px-5 py-4">
                      <SupportStatusBadge status={ticket.status} />
                    </td>
                    <td className="px-5 py-4 text-sm">
                      {ticket.assignedTo
                        ? `${ticket.assignedTo.firstName} ${ticket.assignedTo.lastName}`
                        : 'Unassigned'}
                    </td>
                    <td className="px-5 py-4">{ticket.messageCount}</td>
                    <td className="px-5 py-4 text-sm">{formatDate(ticket.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </AdminTable>
            <AdminPagination
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
