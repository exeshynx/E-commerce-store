import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { Helmet } from 'react-helmet-async';
import { toast } from 'sonner';
import { adminApi, adminQueryKeys, type CampaignWriteRequest } from '../../lib/admin-api';
import { getApiErrorMessage } from '../../lib/api-error';
import { formatDate } from '../../lib/format-date';
import { AdminErrorState, AdminLoadingState, AdminPageHeader } from '../components/admin-ui';

const initialForm: CampaignWriteRequest = {
  audience: 'ALL_REGISTERED',
  message: '',
  name: '',
  subject: '',
};

export const AdminCampaignsPage = () => {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(initialForm);
  const campaigns = useQuery({
    queryFn: adminApi.listCampaigns,
    queryKey: adminQueryKeys.campaigns,
  });
  const create = useMutation({
    mutationFn: adminApi.createCampaign,
    onError: (error) => toast.error(getApiErrorMessage(error)),
    onSuccess: async () => {
      setForm(initialForm);
      await queryClient.invalidateQueries({ queryKey: adminQueryKeys.campaigns });
      toast.success('Campaign draft created.');
    },
  });
  const queue = useMutation({
    mutationFn: adminApi.queueCampaign,
    onError: (error) => toast.error(getApiErrorMessage(error)),
    onSuccess: async (campaign) => {
      await queryClient.invalidateQueries({ queryKey: adminQueryKeys.campaigns });
      toast.success(`${campaign.recipientCount} campaign messages queued.`);
    },
  });
  const submit = (event: FormEvent) => {
    event.preventDefault();
    create.mutate(form);
  };

  return (
    <>
      <Helmet>
        <title>Campaigns — Veyora Admin</title>
      </Helmet>
      <AdminPageHeader
        description="Create a custom message, select a registered-user audience, then queue delivery through the configured SMTP worker."
        eyebrow="Customer engagement"
        title="Campaigns"
      />
      <div className="mt-8 grid gap-8 xl:grid-cols-[24rem_1fr]">
        <form
          className="border-ink/10 h-fit space-y-5 rounded-2xl border bg-white p-6"
          onSubmit={submit}
        >
          <h2 className="font-display text-2xl">New campaign</h2>
          <label className="block text-sm">
            Name
            <input
              className="border-ink/15 mt-2 w-full rounded-xl border px-4 py-3"
              maxLength={160}
              required
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
            />
          </label>
          <label className="block text-sm">
            Email subject
            <input
              className="border-ink/15 mt-2 w-full rounded-xl border px-4 py-3"
              maxLength={255}
              required
              value={form.subject}
              onChange={(event) => setForm({ ...form, subject: event.target.value })}
            />
          </label>
          <label className="block text-sm">
            Audience
            <select
              className="border-ink/15 mt-2 w-full rounded-xl border px-4 py-3"
              value={form.audience}
              onChange={(event) =>
                setForm({
                  ...form,
                  audience: event.target.value as CampaignWriteRequest['audience'],
                })
              }
            >
              <option value="ALL_REGISTERED">All registered customers</option>
              <option value="CUSTOMERS_WITH_CARTS">Customers with cart items</option>
              <option value="PURCHASERS">Customers who completed purchases</option>
            </select>
          </label>
          <label className="block text-sm">
            Custom message
            <textarea
              className="border-ink/15 mt-2 min-h-40 w-full rounded-xl border px-4 py-3"
              maxLength={10_000}
              required
              value={form.message}
              onChange={(event) => setForm({ ...form, message: event.target.value })}
            />
          </label>
          <button
            className="bg-ink w-full rounded-full px-5 py-3 text-xs font-semibold tracking-wider text-white uppercase disabled:opacity-50"
            disabled={create.isPending}
            type="submit"
          >
            {create.isPending ? 'Creating…' : 'Create draft'}
          </button>
        </form>
        <section>
          {campaigns.isPending ? <AdminLoadingState rows={5} /> : null}
          {campaigns.isError ? (
            <AdminErrorState
              message={getApiErrorMessage(campaigns.error)}
              retry={() => void campaigns.refetch()}
            />
          ) : null}
          <div className="space-y-4">
            {campaigns.data?.items.map((campaign) => (
              <article className="border-ink/10 rounded-2xl border bg-white p-6" key={campaign.id}>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-champagne text-xs font-semibold tracking-wider uppercase">
                      {campaign.audience.replaceAll('_', ' ')}
                    </p>
                    <h2 className="font-display mt-2 text-3xl">{campaign.name}</h2>
                    <p className="text-ink/50 mt-1 text-sm">
                      {campaign.subject} · {formatDate(campaign.createdAt)}
                    </p>
                  </div>
                  <button
                    className="border-ink/15 rounded-full border px-5 py-2 text-xs font-semibold uppercase disabled:opacity-40"
                    disabled={campaign.status === 'QUEUED' || queue.isPending}
                    onClick={() => queue.mutate(campaign.id)}
                    type="button"
                  >
                    {campaign.status === 'QUEUED'
                      ? `Queued · ${campaign.recipientCount}`
                      : 'Queue messages'}
                  </button>
                </div>
                <p className="text-ink/65 mt-5 leading-7 whitespace-pre-line">{campaign.message}</p>
              </article>
            ))}
            {campaigns.data?.items.length === 0 ? (
              <p className="text-ink/50 rounded-2xl border p-10 text-center">No campaigns yet.</p>
            ) : null}
          </div>
        </section>
      </div>
    </>
  );
};
