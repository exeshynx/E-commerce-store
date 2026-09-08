import type { Coupon, CouponType, CouponWriteRequest } from '@veyora/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { Helmet } from 'react-helmet-async';
import { FiPlus } from 'react-icons/fi';
import { toast } from 'sonner';
import { adminApi, adminQueryKeys, type AdminCouponListParameters } from '../../lib/admin-api';
import { getApiErrorMessage } from '../../lib/api-error';
import { formatDate } from '../../lib/format-date';
import { formatPrice } from '../../lib/format-price';
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

type CouponForm = {
  code: string;
  currency: string;
  description: string;
  expiresAt: string;
  isEnabled: boolean;
  maximumUses: string;
  maximumUsesPerCustomer: string;
  minimumOrderValue: string;
  startsAt: string;
  type: CouponType;
  value: string;
};
const emptyForm: CouponForm = {
  code: '',
  currency: 'PKR',
  description: '',
  expiresAt: '',
  isEnabled: true,
  maximumUses: '',
  maximumUsesPerCustomer: '1',
  minimumOrderValue: '',
  startsAt: '',
  type: 'PERCENTAGE',
  value: '',
};
const dateInput = (value: string | null) =>
  value ? new Date(value).toISOString().slice(0, 16) : '';

export const AdminCouponsPage = () => {
  const filters = useAdminListFilters();
  const queryClient = useQueryClient();
  const status = (filters.searchParams.get('status') || 'all') as NonNullable<
    AdminCouponListParameters['status']
  >;
  const parameters: AdminCouponListParameters = {
    page: filters.page,
    pageSize: 20,
    status,
    ...(filters.query ? { q: filters.query } : {}),
  };
  const query = useQuery({
    queryFn: () => adminApi.listCoupons(parameters),
    queryKey: adminQueryKeys.coupons(parameters),
  });
  const [editing, setEditing] = useState<Coupon | 'new' | null>(null);
  const [form, setForm] = useState<CouponForm>(emptyForm);
  const payload = (): CouponWriteRequest => ({
    code: form.code,
    currency: form.currency,
    description: form.description.trim() || null,
    expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : null,
    isEnabled: form.isEnabled,
    maximumUses: form.maximumUses ? Number(form.maximumUses) : null,
    maximumUsesPerCustomer: form.maximumUsesPerCustomer
      ? Number(form.maximumUsesPerCustomer)
      : null,
    minimumOrderValue: form.minimumOrderValue ? Number(form.minimumOrderValue) : null,
    startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : null,
    type: form.type,
    value: Number(form.value),
  });
  const save = useMutation({
    mutationFn: () =>
      editing === 'new'
        ? adminApi.createCoupon(payload())
        : adminApi.updateCoupon(editing?.id ?? '', payload()),
    onSuccess: async () => {
      toast.success('Coupon saved.');
      setEditing(null);
      await queryClient.invalidateQueries({ queryKey: ['admin', 'coupons'] });
    },
  });
  const toggle = useMutation({
    mutationFn: (coupon: Coupon) =>
      adminApi.updateCoupon(coupon.id, { isEnabled: !coupon.isEnabled }),
    onSuccess: async () => {
      toast.success('Coupon status updated.');
      await queryClient.invalidateQueries({ queryKey: ['admin', 'coupons'] });
    },
  });
  const open = (coupon: Coupon | 'new') => {
    setEditing(coupon);
    setForm(
      coupon === 'new'
        ? emptyForm
        : {
            code: coupon.code,
            currency: coupon.currency,
            description: coupon.description ?? '',
            expiresAt: dateInput(coupon.expiresAt),
            isEnabled: coupon.isEnabled,
            maximumUses: coupon.maximumUses?.toString() ?? '',
            maximumUsesPerCustomer: coupon.maximumUsesPerCustomer?.toString() ?? '',
            minimumOrderValue: coupon.minimumOrderValue ?? '',
            startsAt: dateInput(coupon.startsAt),
            type: coupon.type,
            value: coupon.value,
          },
    );
    save.reset();
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    save.mutate();
  };
  const input = (key: keyof CouponForm, label: string, type = 'text') => (
    <label className="block text-sm font-semibold">
      {label}
      <input
        className="mt-2 w-full rounded-xl border px-4 py-3 font-normal"
        min={type === 'number' ? '0' : undefined}
        required={key === 'code' || key === 'value'}
        type={type}
        value={String(form[key])}
        onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))}
      />
    </label>
  );
  return (
    <>
      <Helmet>
        <title>Coupons — Veyora Administration</title>
      </Helmet>
      <AdminPageHeader
        actions={
          <button
            className="bg-ink flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white"
            onClick={() => open('new')}
          >
            <FiPlus />
            New coupon
          </button>
        }
        description="Create time-bound promotions with transactional global and per-customer usage limits."
        eyebrow="Promotions"
        title="Coupons"
      />
      <div className="mt-8 flex flex-col gap-3 lg:flex-row">
        <AdminSearchBar
          onChange={filters.setSearch}
          onSubmit={() => filters.updateFilters({ q: filters.search.trim() || undefined })}
          placeholder="Search code or description"
          value={filters.search}
        />
        <select
          className="rounded-xl border bg-white px-4 py-2.5"
          value={status}
          onChange={(event) => filters.updateFilters({ status: event.target.value })}
        >
          {['all', 'active', 'scheduled', 'expired', 'enabled', 'disabled'].map((item) => (
            <option key={item} value={item}>
              {item.replace('_', ' ')}
            </option>
          ))}
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
            title="No coupons found"
            message="Create a promotion or adjust the filters."
          />
        ) : null}
        {query.data?.items.length ? (
          <div className="space-y-5">
            <AdminTable minWidth="68rem">
              <AdminTableHead>
                <tr>
                  <th className="px-5 py-3">Code</th>
                  <th className="px-5 py-3">Value</th>
                  <th className="px-5 py-3">Minimum</th>
                  <th className="px-5 py-3">Window</th>
                  <th className="px-5 py-3">Usage</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Actions</th>
                </tr>
              </AdminTableHead>
              <tbody className="divide-y">
                {query.data.items.map((coupon) => (
                  <tr key={coupon.id}>
                    <td className="px-5 py-4">
                      <p className="font-mono font-semibold">{coupon.code}</p>
                      <p className="text-ink/45 text-xs">{coupon.description}</p>
                    </td>
                    <td className="px-5 py-4">
                      {coupon.type === 'PERCENTAGE'
                        ? `${coupon.value}%`
                        : formatPrice(coupon.value, coupon.currency)}
                    </td>
                    <td className="px-5 py-4">
                      {coupon.minimumOrderValue
                        ? formatPrice(coupon.minimumOrderValue, coupon.currency)
                        : 'None'}
                    </td>
                    <td className="px-5 py-4 text-xs">
                      {coupon.startsAt ? formatDate(coupon.startsAt) : 'Immediately'}
                      <br />
                      {coupon.expiresAt ? `to ${formatDate(coupon.expiresAt)}` : 'No expiry'}
                    </td>
                    <td className="px-5 py-4">
                      {coupon.totalUses}
                      {coupon.maximumUses ? ` / ${coupon.maximumUses}` : ''}
                      <p className="text-ink/45 text-xs">
                        {coupon.maximumUsesPerCustomer ?? 'Unlimited'} per customer
                      </p>
                    </td>
                    <td className="px-5 py-4">
                      <AdminBadge tone={coupon.isEnabled ? 'good' : 'neutral'}>
                        {coupon.isEnabled ? 'Enabled' : 'Disabled'}
                      </AdminBadge>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex gap-3 text-sm font-semibold">
                        <button className="underline" onClick={() => open(coupon)}>
                          Edit
                        </button>
                        <button
                          className={
                            coupon.isEnabled
                              ? 'text-red-700 underline'
                              : 'text-emerald-700 underline'
                          }
                          disabled={toggle.isPending}
                          onClick={() => toggle.mutate(coupon)}
                        >
                          {coupon.isEnabled ? 'Disable' : 'Enable'}
                        </button>
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
      {editing ? (
        <AdminModal
          onClose={() => setEditing(null)}
          title={editing === 'new' ? 'Create coupon' : 'Edit coupon'}
        >
          <form className="grid gap-4 sm:grid-cols-2" onSubmit={submit}>
            {input('code', 'Code')}
            {input('currency', 'Currency')}
            <label className="block text-sm font-semibold">
              Type
              <select
                className="mt-2 w-full rounded-xl border px-4 py-3 font-normal"
                value={form.type}
                onChange={(event) =>
                  setForm((current) => ({ ...current, type: event.target.value as CouponType }))
                }
              >
                <option value="PERCENTAGE">Percentage</option>
                <option value="FIXED_AMOUNT">Fixed amount</option>
              </select>
            </label>
            {input('value', form.type === 'PERCENTAGE' ? 'Percentage' : 'Fixed amount', 'number')}
            {input('minimumOrderValue', 'Minimum order value', 'number')}
            {input('maximumUses', 'Maximum uses', 'number')}
            {input('maximumUsesPerCustomer', 'Uses per customer', 'number')}
            {input('startsAt', 'Starts at', 'datetime-local')}
            {input('expiresAt', 'Expires at', 'datetime-local')}
            <label className="block text-sm font-semibold sm:col-span-2">
              Description
              <textarea
                className="mt-2 min-h-24 w-full rounded-xl border px-4 py-3 font-normal"
                maxLength={500}
                value={form.description}
                onChange={(event) =>
                  setForm((current) => ({ ...current, description: event.target.value }))
                }
              />
            </label>
            <label className="text-sm font-semibold sm:col-span-2">
              <input
                checked={form.isEnabled}
                onChange={(event) =>
                  setForm((current) => ({ ...current, isEnabled: event.target.checked }))
                }
                type="checkbox"
              />{' '}
              Enabled
            </label>
            {save.isError ? (
              <p className="text-red-700 sm:col-span-2">{getApiErrorMessage(save.error)}</p>
            ) : null}
            <div className="flex justify-end gap-3 sm:col-span-2">
              <button
                className="rounded-xl border px-4 py-2"
                onClick={() => setEditing(null)}
                type="button"
              >
                Cancel
              </button>
              <button
                className="bg-ink rounded-xl px-4 py-2 font-semibold text-white"
                disabled={save.isPending}
                type="submit"
              >
                Save coupon
              </button>
            </div>
          </form>
        </AdminModal>
      ) : null}
    </>
  );
};
