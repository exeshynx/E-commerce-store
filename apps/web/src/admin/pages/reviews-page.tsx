import type { AdminReviewUpdateRequest, ProductReview, ReviewStatus } from '@aurelia/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { Helmet } from 'react-helmet-async';
import { toast } from 'sonner';
import { adminApi, adminQueryKeys, type AdminReviewListParameters } from '../../lib/admin-api';
import { getApiErrorMessage } from '../../lib/api-error';
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

type ReviewAction = AdminReviewUpdateRequest['action'];
const statuses: ReviewStatus[] = ['PENDING', 'APPROVED', 'REJECTED'];

export const AdminReviewsPage = () => {
  const filters = useAdminListFilters();
  const queryClient = useQueryClient();
  const status = (filters.searchParams.get('status') || undefined) as ReviewStatus | undefined;
  const visibility = (filters.searchParams.get('visibility') || 'all') as NonNullable<
    AdminReviewListParameters['visibility']
  >;
  const parameters: AdminReviewListParameters = {
    page: filters.page,
    pageSize: 20,
    visibility,
    ...(filters.query ? { q: filters.query } : {}),
    ...(status ? { status } : {}),
  };
  const query = useQuery({
    queryFn: () => adminApi.listReviews(parameters),
    queryKey: adminQueryKeys.reviews(parameters),
  });
  const [selected, setSelected] = useState<{ action: ReviewAction; review: ProductReview } | null>(
    null,
  );
  const [note, setNote] = useState('');
  const mutation = useMutation({
    mutationFn: () => {
      if (!selected) throw new Error('Select a review');
      const optionalNote = note.trim() ? { note: note.trim() } : {};
      let input: AdminReviewUpdateRequest;
      switch (selected.action) {
        case 'approve':
          input = { action: 'approve', ...optionalNote };
          break;
        case 'reject':
          input = { action: 'reject', note };
          break;
        case 'delete':
          input = { action: 'delete', ...optionalNote };
          break;
        case 'restore':
          input = { action: 'restore', ...optionalNote };
          break;
      }
      return adminApi.moderateReview(selected.review.id, input);
    },
    onSuccess: async () => {
      toast.success('Review moderation saved.');
      setSelected(null);
      setNote('');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin', 'reviews'] }),
        queryClient.invalidateQueries({ queryKey: ['reviews'] }),
      ]);
    },
  });
  const open = (review: ProductReview, action: ReviewAction) => {
    setSelected({ action, review });
    setNote('');
    mutation.reset();
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    mutation.mutate();
  };
  return (
    <>
      <Helmet>
        <title>Reviews — Veyora Administration</title>
      </Helmet>
      <AdminPageHeader
        description="Moderate verified-purchase reviews without removing historical records."
        eyebrow="Customer experience"
        title="Reviews"
      />
      <div className="mt-8 flex flex-col gap-3 lg:flex-row">
        <AdminSearchBar
          onChange={filters.setSearch}
          onSubmit={() => filters.updateFilters({ q: filters.search.trim() || undefined })}
          placeholder="Product, customer, or review text"
          value={filters.search}
        />
        <select
          className="rounded-xl border bg-white px-4 py-2.5"
          value={status ?? ''}
          onChange={(event) => filters.updateFilters({ status: event.target.value || undefined })}
        >
          <option value="">All statuses</option>
          {statuses.map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
        <select
          className="rounded-xl border bg-white px-4 py-2.5"
          value={visibility}
          onChange={(event) => filters.updateFilters({ visibility: event.target.value })}
        >
          <option value="all">All visibility</option>
          <option value="visible">Visible records</option>
          <option value="deleted">Soft deleted</option>
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
            title="No reviews found"
            message="Customer reviews will appear here for moderation."
          />
        ) : null}
        {query.data?.items.length ? (
          <div className="space-y-5">
            <AdminTable minWidth="70rem">
              <AdminTableHead>
                <tr>
                  <th className="px-5 py-3">Product</th>
                  <th className="px-5 py-3">Customer</th>
                  <th className="px-5 py-3">Rating</th>
                  <th className="px-5 py-3">Review</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Submitted</th>
                  <th className="px-5 py-3">Actions</th>
                </tr>
              </AdminTableHead>
              <tbody className="divide-y">
                {query.data.items.map((review) => (
                  <tr key={review.id}>
                    <td className="px-5 py-4 font-semibold">{review.product.name}</td>
                    <td className="px-5 py-4">
                      {review.user.firstName} {review.user.lastName}
                      <p className="text-ink/45 text-xs">{review.user.email}</p>
                    </td>
                    <td className="px-5 py-4 text-amber-600">{'★'.repeat(review.rating)}</td>
                    <td className="max-w-md px-5 py-4">
                      <p className="font-semibold">{review.title}</p>
                      <p className="text-ink/55 line-clamp-3 text-sm">{review.body}</p>
                    </td>
                    <td className="px-5 py-4">
                      <AdminBadge
                        tone={
                          review.deletedAt
                            ? 'neutral'
                            : review.status === 'APPROVED'
                              ? 'good'
                              : review.status === 'REJECTED'
                                ? 'danger'
                                : 'warning'
                        }
                      >
                        {review.deletedAt ? 'DELETED' : review.status}
                      </AdminBadge>
                    </td>
                    <td className="px-5 py-4 text-sm">{formatDate(review.createdAt)}</td>
                    <td className="px-5 py-4">
                      <div className="flex flex-wrap gap-2 text-xs font-semibold">
                        {review.deletedAt ? (
                          <button className="underline" onClick={() => open(review, 'restore')}>
                            Restore
                          </button>
                        ) : (
                          <>
                            <button
                              className="text-emerald-700 underline"
                              onClick={() => open(review, 'approve')}
                            >
                              Approve
                            </button>
                            <button
                              className="text-amber-700 underline"
                              onClick={() => open(review, 'reject')}
                            >
                              Reject
                            </button>
                            <button
                              className="text-red-700 underline"
                              onClick={() => open(review, 'delete')}
                            >
                              Delete
                            </button>
                          </>
                        )}
                      </div>
                    </td>
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
      {selected ? (
        <AdminModal
          onClose={() => setSelected(null)}
          title={`${selected.action[0]!.toUpperCase()}${selected.action.slice(1)} review`}
        >
          <form onSubmit={submit}>
            <p className="text-ink/60 text-sm">
              {selected.review.product.name} · {selected.review.user.firstName}{' '}
              {selected.review.user.lastName}
            </p>
            <label className="mt-5 block text-sm font-semibold">
              Moderation note
              <textarea
                className="mt-2 min-h-24 w-full rounded-xl border px-4 py-3 font-normal"
                maxLength={500}
                required={selected.action === 'reject'}
                value={note}
                onChange={(event) => setNote(event.target.value)}
              />
            </label>
            {mutation.isError ? (
              <p className="mt-3 text-red-700">{getApiErrorMessage(mutation.error)}</p>
            ) : null}
            <div className="mt-6 flex justify-end gap-3">
              <button
                className="rounded-xl border px-4 py-2"
                onClick={() => setSelected(null)}
                type="button"
              >
                Cancel
              </button>
              <button
                className="bg-ink rounded-xl px-4 py-2 font-semibold text-white"
                disabled={mutation.isPending}
                type="submit"
              >
                Confirm
              </button>
            </div>
          </form>
        </AdminModal>
      ) : null}
    </>
  );
};
