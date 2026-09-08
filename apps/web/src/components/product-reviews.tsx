import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { getApiErrorMessage } from '../lib/api-error';
import { reviewQueryKeys, reviewsApi } from '../lib/reviews-api';
import { useAuthStore } from '../stores/auth-store';

export const ProductReviews = ({ productId }: { productId: string }) => {
  const user = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState('newest');
  const [form, setForm] = useState({ body: '', rating: 5, title: '' });
  const query = useQuery({
    queryFn: () => reviewsApi.list(productId, page, sort),
    queryKey: reviewQueryKeys.product(productId, page, sort),
  });
  const viewerReview = query.data?.viewerReview;
  const formSourceKey =
    viewerReview && !viewerReview.deletedAt ? `${viewerReview.id}:${viewerReview.updatedAt}` : '';
  const [loadedReviewKey, setLoadedReviewKey] = useState('');
  if (formSourceKey !== loadedReviewKey) {
    setLoadedReviewKey(formSourceKey);
    setForm({
      body: viewerReview && !viewerReview.deletedAt ? viewerReview.body : '',
      rating: viewerReview && !viewerReview.deletedAt ? viewerReview.rating : 5,
      title: viewerReview && !viewerReview.deletedAt ? (viewerReview.title ?? '') : '',
    });
  }
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['reviews', productId] });
  const save = useMutation({
    mutationFn: () =>
      viewerReview && !viewerReview.deletedAt
        ? reviewsApi.update(viewerReview.id, {
            body: form.body,
            rating: form.rating,
            title: form.title.trim() || null,
          })
        : reviewsApi.create(productId, {
            body: form.body,
            rating: form.rating,
            title: form.title.trim() || null,
          }),
    onSuccess: async () => {
      toast.success('Review submitted for moderation.');
      await refresh();
    },
  });
  const remove = useMutation({
    mutationFn: (id: string) => reviewsApi.delete(id),
    onSuccess: async () => {
      setForm({ body: '', rating: 5, title: '' });
      toast.success('Review removed.');
      await refresh();
    },
  });
  const submit = (event: FormEvent) => {
    event.preventDefault();
    save.mutate();
  };
  const summary = query.data?.summary;
  return (
    <section className="border-ink/10 border-t py-14" aria-labelledby="reviews-heading">
      <div className="grid gap-10 lg:grid-cols-[18rem_1fr]">
        <div>
          <p className="text-champagne text-xs font-semibold tracking-wider uppercase">
            Verified purchasers
          </p>
          <h2 className="font-display mt-3 text-4xl" id="reviews-heading">
            Customer reviews
          </h2>
          {summary ? (
            <>
              <p className="font-display mt-6 text-5xl">
                {Number(summary.averageRating).toFixed(1)}{' '}
                <span className="text-champagne text-2xl" aria-hidden="true">
                  ★
                </span>
              </p>
              <p className="text-ink/50 text-sm">
                From {summary.totalReviews} approved{' '}
                {summary.totalReviews === 1 ? 'review' : 'reviews'}
              </p>
              <div className="mt-5 space-y-2">
                {[5, 4, 3, 2, 1].map((rating) => (
                  <div className="flex items-center gap-3 text-xs" key={rating}>
                    <span>{rating}★</span>
                    <div className="bg-mist h-2 flex-1 overflow-hidden rounded-full">
                      <div
                        className="bg-champagne h-full"
                        style={{
                          width: `${summary.totalReviews ? ((summary.distribution[String(rating)] ?? 0) / summary.totalReviews) * 100 : 0}%`,
                        }}
                      />
                    </div>
                    <span>{summary.distribution[String(rating)] ?? 0}</span>
                  </div>
                ))}
              </div>
            </>
          ) : null}
        </div>
        <div>
          {user ? (
            <form className="rounded-3xl bg-white/65 p-6" onSubmit={submit}>
              <div className="flex flex-col justify-between gap-4 sm:flex-row">
                <div>
                  <h3 className="font-display text-2xl">
                    {viewerReview && !viewerReview.deletedAt
                      ? 'Edit your review'
                      : 'Write a review'}
                  </h3>
                  <p className="text-ink/50 mt-1 text-xs">
                    A delivered purchase is required. New and edited reviews are moderated.
                  </p>
                </div>
                {viewerReview && !viewerReview.deletedAt ? (
                  <span className="h-fit rounded-full bg-stone-100 px-3 py-1 text-xs font-semibold">
                    {viewerReview.status}
                  </span>
                ) : null}
              </div>
              <div className="mt-5 grid gap-4 sm:grid-cols-[8rem_1fr]">
                <label className="text-sm font-semibold">
                  Rating
                  <select
                    className="border-ink/15 mt-2 w-full rounded-xl border px-3 py-2"
                    value={form.rating}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, rating: Number(event.target.value) }))
                    }
                  >
                    {[5, 4, 3, 2, 1].map((rating) => (
                      <option key={rating} value={rating}>
                        {rating} stars
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm font-semibold">
                  Title
                  <input
                    className="border-ink/15 mt-2 w-full rounded-xl border px-3 py-2 font-normal"
                    maxLength={120}
                    value={form.title}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, title: event.target.value }))
                    }
                  />
                </label>
              </div>
              <label className="mt-4 block text-sm font-semibold">
                Review
                <textarea
                  className="border-ink/15 mt-2 min-h-28 w-full rounded-xl border px-4 py-3 font-normal"
                  minLength={10}
                  maxLength={5000}
                  required
                  value={form.body}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, body: event.target.value }))
                  }
                />
              </label>
              {save.isError ? (
                <p className="mt-3 text-sm text-red-700" role="alert">
                  {getApiErrorMessage(save.error)}
                </p>
              ) : null}
              <div className="mt-5 flex gap-4">
                <button
                  className="bg-ink rounded-full px-5 py-2.5 text-xs font-semibold text-white uppercase disabled:opacity-40"
                  disabled={save.isPending}
                  type="submit"
                >
                  {save.isPending ? 'Submitting…' : 'Submit review'}
                </button>
                {viewerReview && !viewerReview.deletedAt ? (
                  <button
                    className="text-xs font-semibold text-red-700 underline"
                    disabled={remove.isPending}
                    onClick={() => remove.mutate(viewerReview.id)}
                    type="button"
                  >
                    Delete
                  </button>
                ) : null}
              </div>
            </form>
          ) : (
            <p className="rounded-2xl bg-white/65 p-5 text-sm">
              Sign in and complete a purchase to leave a verified review.
            </p>
          )}
          <div className="mt-8 flex justify-end">
            <label className="text-sm">
              Sort{' '}
              <select
                className="border-ink/15 ml-2 rounded-lg border px-3 py-2"
                value={sort}
                onChange={(event) => {
                  setSort(event.target.value);
                  setPage(1);
                }}
              >
                <option value="newest">Newest</option>
                <option value="highest">Highest rated</option>
                <option value="lowest">Lowest rated</option>
              </select>
            </label>
          </div>
          {query.isPending ? <div className="bg-mist mt-5 h-40 animate-pulse rounded-2xl" /> : null}
          {query.isError ? (
            <p className="mt-5 rounded-xl bg-red-50 p-4 text-red-700" role="alert">
              {getApiErrorMessage(query.error)}
            </p>
          ) : null}
          {query.data?.items.length === 0 ? (
            <p className="text-ink/50 mt-8 text-center">No approved reviews yet.</p>
          ) : null}
          <div className="mt-5 space-y-4">
            {query.data?.items.map((review) => (
              <article className="border-ink/10 rounded-2xl border bg-white/50 p-5" key={review.id}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold">
                      {review.user.firstName} {review.user.lastName}
                    </p>
                    <p className="text-ink/45 text-xs">
                      Verified purchase · {new Date(review.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <p className="text-champagne" aria-label={`${review.rating} out of 5 stars`}>
                    {'★'.repeat(review.rating)}
                    <span className="text-mist">{'★'.repeat(5 - review.rating)}</span>
                  </p>
                </div>
                {review.title ? <h3 className="mt-4 font-semibold">{review.title}</h3> : null}
                <p className="text-ink/65 mt-2 leading-6 whitespace-pre-line">{review.body}</p>
              </article>
            ))}
          </div>
          {query.data && query.data.pagination.totalPages > 1 ? (
            <nav className="mt-7 flex justify-center gap-4" aria-label="Review pagination">
              <button
                disabled={page <= 1}
                onClick={() => setPage((current) => current - 1)}
                type="button"
              >
                Previous
              </button>
              <span>
                Page {page} of {query.data.pagination.totalPages}
              </span>
              <button
                disabled={page >= query.data.pagination.totalPages}
                onClick={() => setPage((current) => current + 1)}
                type="button"
              >
                Next
              </button>
            </nav>
          ) : null}
        </div>
      </div>
    </section>
  );
};
