import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link, useNavigate } from 'react-router-dom';
import { SiteHeader } from '../components/site-header';
import { SupportStatusBadge } from '../components/support-status-badge';
import { getApiErrorMessage } from '../lib/api-error';
import { formatDate } from '../lib/format-date';
import { supportApi, supportQueryKeys } from '../lib/support-api';

const pageSize = 10;

export const SupportTicketsPage = () => {
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [orderId, setOrderId] = useState('');
  const [attachment, setAttachment] = useState<File | null>(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const query = useQuery({
    queryFn: () => supportApi.list(page, pageSize),
    queryKey: supportQueryKeys.list(page, pageSize),
  });
  const create = useMutation({
    mutationFn: () =>
      supportApi.create({
        subject,
        body,
        ...(orderId.trim() ? { orderId: orderId.trim() } : {}),
        ...(attachment
          ? {
              attachments: [
                {
                  fileName: attachment.name,
                  mediaType: attachment.type || 'application/octet-stream',
                  sizeBytes: attachment.size,
                },
              ],
            }
          : {}),
      }),
    onSuccess: ({ ticket }) => {
      void queryClient.invalidateQueries({ queryKey: supportQueryKeys.all });
      void navigate(`/support/${ticket.id}`);
    },
  });
  const submit = (event: FormEvent) => {
    event.preventDefault();
    create.mutate();
  };
  return (
    <>
      <Helmet>
        <title>Customer Support — Veyora</title>
      </Helmet>
      <main className="bg-porcelain min-h-screen px-4 py-8 sm:px-10 lg:px-16">
        <div className="mx-auto max-w-6xl">
          <SiteHeader />
          <section className="py-14">
            <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
              <div>
                <p className="text-champagne text-xs font-bold uppercase">After-sales service</p>
                <h1 className="font-display mt-3 text-5xl">Support tickets</h1>
              </div>
              <button
                className="bg-ink rounded-full px-5 py-3 text-sm font-semibold text-white"
                onClick={() => setShowForm((value) => !value)}
              >
                {showForm ? 'Cancel' : 'Create ticket'}
              </button>
            </div>
            {showForm ? (
              <form
                className="border-ink/10 mt-8 grid gap-4 rounded-2xl border bg-white p-6"
                onSubmit={submit}
              >
                <label className="text-sm font-semibold">
                  Subject
                  <input
                    className="mt-2 w-full rounded-xl border px-4 py-3 font-normal"
                    maxLength={180}
                    minLength={3}
                    onChange={(event) => setSubject(event.target.value)}
                    required
                    value={subject}
                  />
                </label>
                <label className="text-sm font-semibold">
                  Message
                  <textarea
                    className="mt-2 min-h-32 w-full rounded-xl border px-4 py-3 font-normal"
                    maxLength={10000}
                    onChange={(event) => setBody(event.target.value)}
                    required
                    value={body}
                  />
                </label>
                <label className="text-sm font-semibold">
                  Order ID <span className="text-ink/40 font-normal">(optional)</span>
                  <input
                    className="mt-2 w-full rounded-xl border px-4 py-3 font-normal"
                    onChange={(event) => setOrderId(event.target.value)}
                    value={orderId}
                  />
                </label>
                <label className="text-sm font-semibold">
                  Attachment metadata{' '}
                  <span className="text-ink/40 font-normal">
                    (optional; file content is not uploaded yet)
                  </span>
                  <input
                    className="mt-2 block w-full text-sm"
                    onChange={(event) => setAttachment(event.target.files?.[0] ?? null)}
                    type="file"
                  />
                </label>
                {create.isError ? (
                  <p className="rounded-xl bg-red-50 p-4 text-sm text-red-800">
                    {getApiErrorMessage(create.error)}
                  </p>
                ) : null}
                <button
                  className="bg-ink w-fit rounded-xl px-6 py-3 font-semibold text-white disabled:opacity-40"
                  disabled={create.isPending}
                >
                  {create.isPending ? 'Creating…' : 'Create support ticket'}
                </button>
              </form>
            ) : null}
            {query.isPending ? (
              <div className="bg-mist mt-8 h-56 animate-pulse rounded-2xl" />
            ) : null}
            {query.isError ? (
              <div className="mt-8 rounded-xl bg-red-50 p-5">{getApiErrorMessage(query.error)}</div>
            ) : null}
            {query.data?.items.length === 0 ? (
              <div className="border-ink/10 mt-8 rounded-2xl border bg-white p-10 text-center">
                <h2 className="font-display text-3xl">No support tickets</h2>
                <p className="text-ink/50 mt-2">
                  Create a ticket when you need help with an order or product.
                </p>
              </div>
            ) : null}
            {query.data?.items.length ? (
              <div className="mt-8 space-y-4">
                {query.data.items.map((ticket) => (
                  <Link
                    className="border-ink/10 block rounded-2xl border bg-white p-5"
                    key={ticket.id}
                    to={`/support/${ticket.id}`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <p className="text-ink/45 text-xs">
                          {ticket.ticketNumber} · Updated {formatDate(ticket.updatedAt)}
                        </p>
                        <h2 className="font-display mt-1 text-2xl">{ticket.subject}</h2>
                        <p className="text-ink/50 mt-1 text-sm">
                          {ticket.messageCount} messages · {ticket.priority} priority
                        </p>
                      </div>
                      <SupportStatusBadge status={ticket.status} />
                    </div>
                  </Link>
                ))}
              </div>
            ) : null}
            {query.data && query.data.pagination.totalPages > 1 ? (
              <div className="mt-8 flex justify-between">
                <button
                  className="rounded-full border px-5 py-2 disabled:opacity-40"
                  disabled={page <= 1}
                  onClick={() => setPage((value) => value - 1)}
                >
                  Previous
                </button>
                <span>
                  Page {page} of {query.data.pagination.totalPages}
                </span>
                <button
                  className="rounded-full border px-5 py-2 disabled:opacity-40"
                  disabled={page >= query.data.pagination.totalPages}
                  onClick={() => setPage((value) => value + 1)}
                >
                  Next
                </button>
              </div>
            ) : null}
          </section>
        </div>
      </main>
    </>
  );
};
