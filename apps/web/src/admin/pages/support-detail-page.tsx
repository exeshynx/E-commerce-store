import type { SupportTicketPriority, SupportTicketStatus } from '@aurelia/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link, useParams } from 'react-router-dom';
import { SupportStatusBadge } from '../../components/support-status-badge';
import { adminApi, adminQueryKeys } from '../../lib/admin-api';
import { getApiErrorMessage } from '../../lib/api-error';
import { formatDate } from '../../lib/format-date';
import { AdminErrorState, AdminLoadingState, AdminPageHeader } from '../components/admin-ui';

const statuses: SupportTicketStatus[] = [
  'OPEN',
  'IN_PROGRESS',
  'WAITING_CUSTOMER',
  'RESOLVED',
  'CLOSED',
];
const priorities: SupportTicketPriority[] = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];

export const AdminSupportDetailPage = () => {
  const { id = '' } = useParams();
  const queryClient = useQueryClient();
  const [body, setBody] = useState('');
  const query = useQuery({
    enabled: Boolean(id),
    queryFn: () => adminApi.getSupportTicket(id),
    queryKey: adminQueryKeys.supportTicket(id),
  });
  const users = useQuery({
    queryFn: () => adminApi.listUsers({ page: 1, pageSize: 100, role: 'ADMIN', status: 'ACTIVE' }),
    queryKey: adminQueryKeys.users({ page: 1, pageSize: 100, role: 'ADMIN', status: 'ACTIVE' }),
  });
  const saveResult = (data: Awaited<ReturnType<typeof adminApi.getSupportTicket>>) => {
    queryClient.setQueryData(adminQueryKeys.supportTicket(id), data);
    void queryClient.invalidateQueries({ queryKey: ['admin', 'support'] });
  };
  const update = useMutation({
    mutationFn: (input: Parameters<typeof adminApi.updateSupportTicket>[1]) =>
      adminApi.updateSupportTicket(id, input),
    onSuccess: saveResult,
  });
  const reply = useMutation({
    mutationFn: () => adminApi.replySupportTicket(id, { body }),
    onSuccess: (data) => {
      saveResult(data);
      setBody('');
    },
  });
  const submit = (event: FormEvent) => {
    event.preventDefault();
    reply.mutate();
  };
  const ticket = query.data?.ticket;
  return (
    <>
      <Helmet>
        <title>Support ticket — Veyora Administration</title>
      </Helmet>
      <Link className="text-sm underline" to="/admin/support">
        ← Support
      </Link>
      {query.isPending ? (
        <div className="mt-6">
          <AdminLoadingState />
        </div>
      ) : null}
      {query.isError ? (
        <div className="mt-6">
          <AdminErrorState message={getApiErrorMessage(query.error)} />
        </div>
      ) : null}
      {ticket ? (
        <div className="mt-6 space-y-7">
          <AdminPageHeader
            description={`${ticket.ticketNumber} · Updated ${formatDate(ticket.updatedAt)}`}
            eyebrow="Customer support"
            title={ticket.subject}
            actions={<SupportStatusBadge status={ticket.status} />}
          />
          <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
            <section className="min-w-0">
              <ol className="space-y-4">
                {ticket.messages.map((message) => (
                  <li
                    className={`max-w-[90%] overflow-hidden rounded-2xl p-5 sm:max-w-[78%] ${message.authorRole === 'ADMIN' ? 'bg-ink ml-auto text-white' : 'border-ink/10 border bg-white'}`}
                    key={message.id}
                  >
                    <p className="truncate text-xs font-bold uppercase opacity-60">
                      {message.author.firstName} {message.author.lastName} ·{' '}
                      {formatDate(message.createdAt)}
                    </p>
                    <p className="mt-3 text-sm leading-6 break-words whitespace-pre-wrap">
                      {message.body}
                    </p>
                    {message.attachments.length ? (
                      <ul className="mt-3 text-xs opacity-70">
                        {message.attachments.map((item) => (
                          <li className="truncate" key={item.id}>
                            {item.fileName} · {item.mediaType}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </li>
                ))}
              </ol>
              {ticket.status !== 'CLOSED' ? (
                <form
                  className="border-ink/10 mt-6 rounded-2xl border bg-white p-5"
                  onSubmit={submit}
                >
                  <textarea
                    className="min-h-32 w-full rounded-xl border px-4 py-3"
                    maxLength={10000}
                    onChange={(event) => setBody(event.target.value)}
                    placeholder="Write an administrator reply"
                    required
                    value={body}
                  />
                  {reply.isError ? (
                    <p className="mt-3 text-sm text-red-700">{getApiErrorMessage(reply.error)}</p>
                  ) : null}
                  <button
                    className="bg-ink mt-3 rounded-xl px-5 py-3 text-sm font-semibold text-white disabled:opacity-40"
                    disabled={reply.isPending}
                  >
                    {reply.isPending ? 'Sending…' : 'Send reply'}
                  </button>
                </form>
              ) : null}
            </section>
            <aside className="border-ink/10 h-fit rounded-2xl border bg-white p-5">
              <h2 className="font-display text-2xl">Ticket controls</h2>
              <label className="mt-5 block text-sm font-semibold">
                Status
                <select
                  className="mt-2 w-full rounded-xl border px-3 py-2 font-normal"
                  onChange={(event) =>
                    update.mutate({ status: event.target.value as SupportTicketStatus })
                  }
                  value={ticket.status}
                >
                  {statuses.map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
              </label>
              <label className="mt-4 block text-sm font-semibold">
                Priority
                <select
                  className="mt-2 w-full rounded-xl border px-3 py-2 font-normal"
                  onChange={(event) =>
                    update.mutate({ priority: event.target.value as SupportTicketPriority })
                  }
                  value={ticket.priority}
                >
                  {priorities.map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
              </label>
              <label className="mt-4 block text-sm font-semibold">
                Assigned administrator
                <select
                  className="mt-2 w-full rounded-xl border px-3 py-2 font-normal"
                  onChange={(event) => update.mutate({ assignedToId: event.target.value || null })}
                  value={ticket.assignedTo?.id ?? ''}
                >
                  <option value="">Unassigned</option>
                  {users.data?.items.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.firstName} {user.lastName}
                    </option>
                  ))}
                </select>
              </label>
              {ticket.customer ? (
                <div className="bg-mist mt-5 rounded-xl p-4 text-sm">
                  <p className="font-semibold">
                    {ticket.customer.firstName} {ticket.customer.lastName}
                  </p>
                  <p className="text-ink/50 break-all">{ticket.customer.email}</p>
                </div>
              ) : null}
              {ticket.order ? (
                <Link
                  className="mt-4 block text-sm font-semibold underline"
                  to={`/admin/orders/${ticket.order.id}`}
                >
                  View {ticket.order.orderNumber}
                </Link>
              ) : null}
              {update.isError ? (
                <p className="mt-4 text-sm text-red-700">{getApiErrorMessage(update.error)}</p>
              ) : null}
            </aside>
          </div>
        </div>
      ) : null}
    </>
  );
};
