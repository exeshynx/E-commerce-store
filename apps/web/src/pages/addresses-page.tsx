import type { AddressWriteRequest, CustomerAddress } from '@aurelia/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useId, useState, type FormEvent } from 'react';
import { Helmet } from 'react-helmet-async';
import { toast } from 'sonner';
import { FormField } from '../components/form-field';
import { SiteHeader } from '../components/site-header';
import { useDialogFocus } from '../hooks/use-dialog-focus';
import { accountApi, accountQueryKeys } from '../lib/account-api';
import { getApiErrorMessage } from '../lib/api-error';
import { useAuthStore } from '../stores/auth-store';

const emptyAddress = (
  user: ReturnType<typeof useAuthStore.getState>['user'],
): AddressWriteRequest => ({
  address: '',
  city: '',
  country: 'Pakistan',
  email: user?.email ?? '',
  fullName: user ? `${user.firstName} ${user.lastName}` : '',
  isDefaultBilling: false,
  isDefaultShipping: false,
  label: 'Home',
  phone: user?.phone ?? '',
  postalCode: '',
  province: '',
});

export const AddressesPage = () => {
  const user = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();
  const addresses = useQuery({
    queryFn: accountApi.listAddresses,
    queryKey: accountQueryKeys.addresses,
  });
  const [editing, setEditing] = useState<CustomerAddress | 'new' | null>(null);
  const [form, setForm] = useState<AddressWriteRequest>(() => emptyAddress(user));
  const dialogTitleId = useId();
  const dialogRef = useDialogFocus<HTMLFormElement>({
    active: Boolean(editing),
    onClose: () => setEditing(null),
  });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: accountQueryKeys.addresses });
  const save = useMutation({
    mutationFn: () =>
      editing === 'new'
        ? accountApi.createAddress(form)
        : accountApi.updateAddress(editing?.id ?? '', form),
    onSuccess: async () => {
      toast.success('Address saved.');
      setEditing(null);
      await Promise.all([
        invalidate(),
        queryClient.invalidateQueries({ queryKey: accountQueryKeys.summary }),
      ]);
    },
  });
  const remove = useMutation({
    mutationFn: accountApi.deleteAddress,
    onSuccess: async () => {
      toast.success('Address removed.');
      await Promise.all([
        invalidate(),
        queryClient.invalidateQueries({ queryKey: accountQueryKeys.summary }),
      ]);
    },
  });
  const openEdit = (address: CustomerAddress) => {
    setForm({
      address: address.address,
      city: address.city,
      country: address.country,
      email: address.email,
      fullName: address.fullName,
      isDefaultBilling: address.isDefaultBilling,
      isDefaultShipping: address.isDefaultShipping,
      label: address.label,
      phone: address.phone,
      postalCode: address.postalCode,
      province: address.province,
    });
    setEditing(address);
  };
  const field = (
    key: keyof AddressWriteRequest,
    label: string,
    options: { type?: string; className?: string } = {},
  ) => (
    <div className={options.className}>
      <FormField
        id={`address-${key}`}
        label={label}
        required
        maxLength={key === 'email' ? 254 : 160}
        type={options.type}
        value={String(form[key] ?? '')}
        onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))}
      />
    </div>
  );
  const submit = (event: FormEvent) => {
    event.preventDefault();
    save.mutate();
  };
  return (
    <>
      <Helmet>
        <title>Saved addresses — Veyora</title>
      </Helmet>
      <main className="bg-porcelain min-h-screen px-6 py-8 sm:px-10 lg:px-16">
        <div className="mx-auto max-w-6xl">
          <SiteHeader />
          <section className="py-14 sm:py-20">
            <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
              <div>
                <p className="text-champagne text-xs font-semibold tracking-[0.2em] uppercase">
                  Account
                </p>
                <h1 className="font-display mt-3 text-5xl">Saved addresses</h1>
              </div>
              <button
                className="bg-ink rounded-full px-6 py-3 text-xs font-semibold text-white uppercase"
                onClick={() => {
                  setForm(emptyAddress(user));
                  setEditing('new');
                }}
                type="button"
              >
                Add address
              </button>
            </div>
            {addresses.isPending ? (
              <div className="bg-mist mt-10 h-48 animate-pulse rounded-3xl" />
            ) : null}
            {addresses.isError ? (
              <p className="mt-8 rounded-xl bg-red-50 p-4 text-red-800" role="alert">
                {getApiErrorMessage(addresses.error)}
              </p>
            ) : null}
            {addresses.data?.items.length === 0 ? (
              <div className="border-ink/10 mt-10 rounded-3xl border p-10 text-center">
                <h2 className="font-display text-3xl">No saved addresses</h2>
                <p className="text-ink/50 mt-2">Save one for a faster checkout.</p>
              </div>
            ) : null}
            <div className="mt-10 grid gap-5 md:grid-cols-2">
              {addresses.data?.items.map((item) => (
                <article className="border-ink/10 rounded-3xl border bg-white/65 p-6" key={item.id}>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h2 className="font-display text-2xl">{item.label}</h2>
                      <div className="mt-2 flex flex-wrap gap-2 text-[0.65rem] font-semibold uppercase">
                        {item.isDefaultShipping ? (
                          <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-emerald-800">
                            Default shipping
                          </span>
                        ) : null}
                        {item.isDefaultBilling ? (
                          <span className="rounded-full bg-amber-100 px-2.5 py-1 text-amber-800">
                            Default billing
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex gap-3 text-sm">
                      <button
                        className="font-semibold underline"
                        onClick={() => openEdit(item)}
                        type="button"
                      >
                        Edit
                      </button>
                      <button
                        className="font-semibold text-red-700 underline"
                        disabled={remove.isPending}
                        onClick={() => remove.mutate(item.id)}
                        type="button"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                  <address className="text-ink/60 mt-5 text-sm leading-6 not-italic">
                    {item.fullName}
                    <br />
                    {item.address}
                    <br />
                    {item.city}, {item.province} {item.postalCode}
                    <br />
                    {item.country}
                    <br />
                    {item.phone} · {item.email}
                  </address>
                </article>
              ))}
            </div>
            {editing ? (
              <div className="fixed inset-0 z-50 overflow-y-auto bg-black/45 p-4">
                <form
                  aria-labelledby={dialogTitleId}
                  aria-modal="true"
                  className="mx-auto my-8 max-w-3xl rounded-3xl bg-white p-6 shadow-2xl sm:p-8"
                  onSubmit={submit}
                  ref={dialogRef}
                  role="dialog"
                  tabIndex={-1}
                >
                  <div className="flex justify-between">
                    <h2 className="font-display text-3xl" id={dialogTitleId}>
                      {editing === 'new' ? 'Add address' : 'Edit address'}
                    </h2>
                    <button
                      aria-label="Close address form"
                      onClick={() => setEditing(null)}
                      type="button"
                    >
                      ✕
                    </button>
                  </div>
                  <div className="mt-6 grid gap-5 sm:grid-cols-2">
                    {field('label', 'Label')}
                    {field('fullName', 'Full name')}
                    {field('phone', 'Phone')}
                    {field('email', 'Email', { type: 'email' })}
                    {field('country', 'Country')}
                    {field('province', 'Province / state')}
                    {field('city', 'City')}
                    {field('postalCode', 'Postal code')}
                    <label className="sm:col-span-2">
                      <span className="text-ink/65 text-xs font-semibold tracking-[0.14em] uppercase">
                        Complete address
                      </span>
                      <textarea
                        className="border-ink/15 mt-2 min-h-28 w-full rounded-xl border px-4 py-3"
                        maxLength={1000}
                        required
                        value={form.address}
                        onChange={(event) =>
                          setForm((current) => ({ ...current, address: event.target.value }))
                        }
                      />
                    </label>
                  </div>
                  <div className="mt-5 flex flex-wrap gap-5 text-sm">
                    <label>
                      <input
                        checked={form.isDefaultShipping ?? false}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            isDefaultShipping: event.target.checked,
                          }))
                        }
                        type="checkbox"
                      />{' '}
                      Default shipping
                    </label>
                    <label>
                      <input
                        checked={form.isDefaultBilling ?? false}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            isDefaultBilling: event.target.checked,
                          }))
                        }
                        type="checkbox"
                      />{' '}
                      Default billing
                    </label>
                  </div>
                  {save.isError ? (
                    <p className="mt-4 text-red-700" role="alert">
                      {getApiErrorMessage(save.error)}
                    </p>
                  ) : null}
                  <div className="mt-7 flex justify-end gap-3">
                    <button
                      className="border-ink/15 rounded-xl border px-5 py-2.5"
                      onClick={() => setEditing(null)}
                      type="button"
                    >
                      Cancel
                    </button>
                    <button
                      className="bg-ink rounded-xl px-5 py-2.5 font-semibold text-white disabled:opacity-40"
                      disabled={save.isPending}
                      type="submit"
                    >
                      {save.isPending ? 'Saving…' : 'Save address'}
                    </button>
                  </div>
                </form>
              </div>
            ) : null}
          </section>
        </div>
      </main>
    </>
  );
};
