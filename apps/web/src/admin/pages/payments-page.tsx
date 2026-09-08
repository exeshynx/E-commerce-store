import type { PaymentProvider, PaymentStatus } from '@veyora/contracts';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { PaymentStatusBadge } from '../../components/payment-status-badge';
import { adminApi, adminQueryKeys, type AdminPaymentListParameters } from '../../lib/admin-api';
import { getApiErrorMessage } from '../../lib/api-error';
import { formatDate } from '../../lib/format-date';
import { formatPrice } from '../../lib/format-price';
import { ManualPaymentActions } from '../components/manual-payment-actions';
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

export const AdminPaymentsPage = () => {
  const filters = useAdminListFilters();
  const queryClient = useQueryClient();
  const provider = (filters.searchParams.get('provider') || undefined) as
    PaymentProvider | undefined;
  const status = (filters.searchParams.get('status') || undefined) as PaymentStatus | undefined;
  const parameters: AdminPaymentListParameters = {
    page: filters.page,
    pageSize,
    ...(filters.query ? { q: filters.query } : {}),
    ...(provider ? { provider } : {}),
    ...(status ? { status } : {}),
  };
  const payments = useQuery({
    queryFn: () => adminApi.listPayments(parameters),
    queryKey: adminQueryKeys.payments(parameters),
  });
  const refreshPaymentData = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['admin', 'payments'] }),
      queryClient.invalidateQueries({ queryKey: ['admin', 'orders'] }),
      queryClient.invalidateQueries({ queryKey: adminQueryKeys.dashboard }),
    ]);
  };

  return (
    <>
      <Helmet>
        <title>Payments — Veyora Administration</title>
      </Helmet>
      <AdminPageHeader
        description="Review provider attempts, webhook outcomes, refunds, and development manual settlements."
        eyebrow="Financial operations"
        title="Payments"
      />
      <div className="mt-8 flex flex-col gap-3 lg:flex-row">
        <AdminSearchBar
          onChange={filters.setSearch}
          onSubmit={() => filters.updateFilters({ q: filters.search.trim() || undefined })}
          placeholder="Order number, email, or provider ID"
          value={filters.search}
        />
        <select
          aria-label="Filter by provider"
          className="border-ink/15 rounded-xl border bg-white px-4 py-2.5 text-sm"
          onChange={(event) => filters.updateFilters({ provider: event.target.value || undefined })}
          value={provider ?? ''}
        >
          <option value="">All providers</option>
          <option value="MANUAL">Manual</option>
          <option value="SAFEPAY">Safepay</option>
          <option value="STRIPE">Stripe</option>
          <option value="PAYPAL">PayPal</option>
          <option value="OTHER">Other</option>
        </select>
        <select
          aria-label="Filter by payment status"
          className="border-ink/15 rounded-xl border bg-white px-4 py-2.5 text-sm"
          onChange={(event) => filters.updateFilters({ status: event.target.value || undefined })}
          value={status ?? ''}
        >
          <option value="">All statuses</option>
          {['PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'CANCELLED', 'REFUNDED'].map(
            (value) => (
              <option key={value} value={value}>
                {value.replaceAll('_', ' ')}
              </option>
            ),
          )}
        </select>
      </div>
      <div className="mt-6">
        {payments.isPending ? <AdminLoadingState /> : null}
        {payments.isError ? (
          <AdminErrorState
            message={getApiErrorMessage(payments.error)}
            retry={() => void payments.refetch()}
          />
        ) : null}
        {payments.data?.items.length === 0 ? (
          <AdminEmptyState
            message="Payment attempts will appear after an order enters the payment flow."
            title="No payments found"
          />
        ) : null}
        {payments.data?.items.length ? (
          <div className="space-y-5">
            <AdminTable>
              <AdminTableHead>
                <tr>
                  <th className="px-5 py-3">Order</th>
                  <th className="px-5 py-3">Provider</th>
                  <th className="px-5 py-3">Amount</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Created</th>
                  <th className="px-5 py-3">Actions</th>
                </tr>
              </AdminTableHead>
              <tbody className="divide-ink/10 divide-y">
                {payments.data.items.map((payment) => (
                  <tr key={payment.id}>
                    <td className="px-5 py-4">
                      <Link
                        className="font-semibold underline"
                        to={`/admin/orders/${payment.order.id}`}
                      >
                        {payment.order.orderNumber}
                      </Link>
                      <p className="text-ink/45 mt-1 text-xs">{payment.order.customer.email}</p>
                    </td>
                    <td className="px-5 py-4">
                      <p className="font-semibold">{payment.provider}</p>
                      <p className="text-ink/40 mt-1 max-w-48 truncate text-xs">
                        {payment.providerPaymentId ?? 'No provider ID'}
                      </p>
                    </td>
                    <td className="px-5 py-4 font-semibold">
                      {formatPrice(payment.amount, payment.currency)}
                    </td>
                    <td className="px-5 py-4">
                      <PaymentStatusBadge status={payment.status} />
                      {payment.failureReason ? (
                        <p className="mt-2 max-w-64 text-xs text-red-700">
                          {payment.failureReason}
                        </p>
                      ) : null}
                    </td>
                    <td className="text-ink/55 px-5 py-4">{formatDate(payment.createdAt)}</td>
                    <td className="px-5 py-4">
                      <div className="flex flex-wrap gap-2">
                        <Link
                          className="border-ink/15 rounded-lg border px-3 py-2 text-xs font-semibold"
                          to={`/admin/payments/${payment.id}`}
                        >
                          View details
                        </Link>
                        <ManualPaymentActions onSettled={refreshPaymentData} payment={payment} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </AdminTable>
            <AdminPagination
              isFetching={payments.isFetching}
              onPageChange={(page) => filters.updateFilters({ page: String(page) })}
              page={payments.data.pagination.page}
              totalPages={payments.data.pagination.totalPages}
            />
          </div>
        ) : null}
      </div>
    </>
  );
};
