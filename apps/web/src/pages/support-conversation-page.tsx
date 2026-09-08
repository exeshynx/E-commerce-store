import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link, useParams } from 'react-router-dom';
import { SiteHeader } from '../components/site-header';
import { SupportStatusBadge } from '../components/support-status-badge';
import { getApiErrorMessage } from '../lib/api-error';
import { formatDate } from '../lib/format-date';
import { supportApi, supportQueryKeys } from '../lib/support-api';

export const SupportConversationPage = () => {
  const { id = '' } = useParams();
  const [body, setBody] = useState('');
  const [attachment, setAttachment] = useState<File | null>(null);
  const queryClient = useQueryClient();
  const query = useQuery({
    enabled: Boolean(id),
    queryFn: () => supportApi.get(id),
    queryKey: supportQueryKeys.detail(id),
  });
  const reply = useMutation({
    mutationFn: () =>
      supportApi.reply(id, {
        body,
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
    onSuccess: (data) => {
      queryClient.setQueryData(supportQueryKeys.detail(id), data);
      setBody('');
      setAttachment(null);
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
        <title>Support conversation — Veyora</title>
      </Helmet>
      <main className="bg-porcelain min-h-screen px-4 py-8 sm:px-10 lg:px-16">
        <div className="mx-auto max-w-5xl">
          <SiteHeader />
          <section className="py-14">
            <Link className="text-sm underline" to="/support">
              ← Support tickets
            </Link>
            {query.isPending ? (
              <div className="bg-mist mt-8 h-72 animate-pulse rounded-2xl" />
            ) : null}
            {query.isError ? (
              <div className="mt-8 rounded-xl bg-red-50 p-5">{getApiErrorMessage(query.error)}</div>
            ) : null}
            {ticket ? (
              <div className="mt-8">
                <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
                  <div>
                    <p className="text-ink/45 text-xs">{ticket.ticketNumber}</p>
                    <h1 className="font-display mt-2 text-4xl sm:text-5xl">{ticket.subject}</h1>
                    <p className="text-ink/50 mt-2">
                      {ticket.priority} priority
                      {ticket.assignedTo ? ` · Assigned to ${ticket.assignedTo.firstName}` : ''}
                    </p>
                  </div>
                  <SupportStatusBadge status={ticket.status} />
                </header>
                <ol className="mt-8 space-y-4">
                  {ticket.messages.map((message) => (
                    <li
                      className={`max-w-[90%] rounded-2xl p-5 sm:max-w-[75%] ${message.authorRole === 'ADMIN' ? 'bg-ink ml-auto text-white' : 'border-ink/10 border bg-white'}`}
                      key={message.id}
                    >
                      <p className="text-xs font-semibold uppercase opacity-60">
                        {message.author.firstName} · {formatDate(message.createdAt)}
                      </p>
                      <p className="mt-3 text-sm leading-6 whitespace-pre-wrap">{message.body}</p>
                      {message.attachments.length ? (
                        <ul className="mt-3 space-y-1 text-xs opacity-70">
                          {message.attachments.map((file) => (
                            <li key={file.id}>
                              {file.fileName} · {Math.ceil(file.sizeBytes / 1024)} KB metadata
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </li>
                  ))}
                </ol>
                {ticket.status !== 'CLOSED' ? (
                  <form
                    className="border-ink/10 mt-8 rounded-2xl border bg-white p-5"
                    onSubmit={submit}
                  >
                    <label className="text-sm font-semibold">
                      Reply
                      <textarea
                        className="mt-2 min-h-28 w-full rounded-xl border px-4 py-3 font-normal"
                        maxLength={10000}
                        onChange={(event) => setBody(event.target.value)}
                        required
                        value={body}
                      />
                    </label>
                    <input
                      className="mt-3 block w-full text-sm"
                      onChange={(event) => setAttachment(event.target.files?.[0] ?? null)}
                      type="file"
                    />
                    {reply.isError ? (
                      <p className="mt-3 text-sm text-red-700">{getApiErrorMessage(reply.error)}</p>
                    ) : null}
                    <button
                      className="bg-ink mt-4 rounded-xl px-6 py-3 font-semibold text-white disabled:opacity-40"
                      disabled={reply.isPending}
                    >
                      {reply.isPending ? 'Sending…' : 'Send reply'}
                    </button>
                  </form>
                ) : (
                  <p className="mt-8 rounded-xl bg-white p-5 text-sm">This ticket is closed.</p>
                )}
              </div>
            ) : null}
          </section>
        </div>
      </main>
    </>
  );
};
