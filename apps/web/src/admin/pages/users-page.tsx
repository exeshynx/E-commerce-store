import { useQuery } from '@tanstack/react-query';
import type { UserRole, UserStatus } from '@veyora/contracts';
import { Helmet } from 'react-helmet-async';
import { getApiErrorMessage } from '../../lib/api-error';
import { adminApi, adminQueryKeys, type AdminUserListParameters } from '../../lib/admin-api';
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

const pageSize = 20;

export const AdminUsersPage = () => {
  const filters = useAdminListFilters();
  const role = (filters.searchParams.get('role') || undefined) as UserRole | undefined;
  const status = (filters.searchParams.get('status') || undefined) as UserStatus | undefined;
  const parameters: AdminUserListParameters = {
    page: filters.page,
    pageSize,
    ...(filters.query ? { q: filters.query } : {}),
    ...(role ? { role } : {}),
    ...(status ? { status } : {}),
  };
  const users = useQuery({
    queryFn: () => adminApi.listUsers(parameters),
    queryKey: adminQueryKeys.users(parameters),
  });

  return (
    <>
      <Helmet>
        <title>Users — Veyora Administration</title>
      </Helmet>
      <AdminPageHeader
        description="Read-only customer and administrator account information."
        eyebrow="People"
        title="Users"
      />
      <div className="mt-8 flex flex-col gap-3 lg:flex-row">
        <AdminSearchBar
          onChange={filters.setSearch}
          onSubmit={() => filters.updateFilters({ q: filters.search.trim() || undefined })}
          placeholder="Search name or email"
          value={filters.search}
        />
        <select
          aria-label="Filter by role"
          className="border-ink/15 rounded-xl border bg-white px-4 py-2.5 text-sm"
          onChange={(event) => filters.updateFilters({ role: event.target.value || undefined })}
          value={role ?? ''}
        >
          <option value="">All roles</option>
          <option value="CUSTOMER">Customers</option>
          <option value="ADMIN">Administrators</option>
        </select>
        <select
          aria-label="Filter by status"
          className="border-ink/15 rounded-xl border bg-white px-4 py-2.5 text-sm"
          onChange={(event) => filters.updateFilters({ status: event.target.value || undefined })}
          value={status ?? ''}
        >
          <option value="">All statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="DISABLED">Disabled</option>
        </select>
      </div>
      <div className="mt-6">
        {users.isPending ? <AdminLoadingState /> : null}
        {users.isError ? (
          <AdminErrorState
            message={getApiErrorMessage(users.error)}
            retry={() => void users.refetch()}
          />
        ) : null}
        {users.data?.items.length === 0 ? (
          <AdminEmptyState message="Try changing your search or filters." title="No users found" />
        ) : null}
        {users.data?.items.length ? (
          <div className="space-y-5">
            <AdminTable>
              <AdminTableHead>
                <tr>
                  <th className="px-5 py-3">User</th>
                  <th className="px-5 py-3">Role</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Orders</th>
                  <th className="px-5 py-3">Registered</th>
                </tr>
              </AdminTableHead>
              <tbody className="divide-ink/10 divide-y">
                {users.data.items.map((user) => (
                  <tr key={user.id}>
                    <td className="px-5 py-4">
                      <p className="font-semibold">
                        {user.firstName} {user.lastName}
                      </p>
                      <p className="text-ink/45 text-xs">{user.email}</p>
                    </td>
                    <td className="px-5 py-4">
                      <AdminBadge>{user.role}</AdminBadge>
                    </td>
                    <td className="px-5 py-4">
                      <AdminBadge tone={user.status === 'ACTIVE' ? 'good' : 'danger'}>
                        {user.status}
                      </AdminBadge>
                    </td>
                    <td className="px-5 py-4">{user.orderCount}</td>
                    <td className="text-ink/55 px-5 py-4">{formatDate(user.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </AdminTable>
            <AdminPagination
              isFetching={users.isFetching}
              onPageChange={(page) => filters.updateFilters({ page: String(page) })}
              page={users.data.pagination.page}
              totalPages={users.data.pagination.totalPages}
            />
          </div>
        ) : null}
      </div>
    </>
  );
};
