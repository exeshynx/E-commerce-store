import { zodResolver } from '@hookform/resolvers/zod';
import type { CheckoutRequest } from '@veyora/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef, useState, type FormEvent } from 'react';
import { useForm } from 'react-hook-form';
import { Helmet } from 'react-helmet-async';
import { Link, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { FormField } from '../components/form-field';
import { SiteHeader } from '../components/site-header';
import { accountApi, accountQueryKeys } from '../lib/account-api';
import { getApiErrorMessage } from '../lib/api-error';
import { commerceApi, commerceQueryKeys } from '../lib/commerce-api';
import { formatPrice } from '../lib/format-price';
import { orderQueryKeys, ordersApi } from '../lib/orders-api';
import { promotionsApi } from '../lib/promotions-api';
import { useAuthStore } from '../stores/auth-store';

const checkoutFormSchema = z.object({
  address: z.string().trim().min(5, 'Enter the complete delivery address').max(1_000),
  city: z.string().trim().min(1, 'Enter the city').max(100),
  country: z.string().trim().min(1, 'Enter the country').max(100),
  email: z.email('Enter a valid email address'),
  fullName: z.string().trim().min(2, 'Enter the recipient name').max(160),
  phone: z
    .string()
    .trim()
    .min(7)
    .max(32)
    .regex(/^\+?[0-9][0-9\s()-]*$/, 'Enter a valid phone number'),
  postalCode: z.string().trim().min(2, 'Enter the postal code').max(20),
  province: z.string().trim().min(1, 'Enter the province or state').max(100),
});

type CheckoutForm = z.infer<typeof checkoutFormSchema>;

export const CheckoutPage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const idempotencyKey = useRef(crypto.randomUUID());
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [couponCode, setCouponCode] = useState('');
  const cartQuery = useQuery({ queryFn: commerceApi.getCart, queryKey: commerceQueryKeys.cart });
  const addressesQuery = useQuery({
    enabled: Boolean(user),
    queryFn: accountApi.listAddresses,
    queryKey: accountQueryKeys.addresses,
  });
  const form = useForm<CheckoutForm>({
    defaultValues: {
      address: '',
      city: '',
      country: 'Pakistan',
      email: user?.email ?? '',
      fullName: user ? `${user.firstName} ${user.lastName}` : '',
      phone: user?.phone ?? '',
      postalCode: '',
      province: '',
    },
    resolver: zodResolver(checkoutFormSchema),
  });
  const effectiveAddressId =
    selectedAddressId ??
    (
      addressesQuery.data?.items.find((item) => item.isDefaultShipping) ??
      addressesQuery.data?.items[0]
    )?.id ??
    '';
  const coupon = useMutation({ mutationFn: promotionsApi.validateCoupon });
  const checkout = useMutation({
    mutationFn: (input: CheckoutRequest) => ordersApi.checkout(input, idempotencyKey.current),
    onSuccess: async (data) => {
      queryClient.setQueryData(orderQueryKeys.detail(data.order.id), data);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: commerceQueryKeys.cart }),
        queryClient.invalidateQueries({ queryKey: orderQueryKeys.all }),
      ]);
      void navigate(`/orders/${data.order.id}/confirmation`, { replace: true });
    },
  });
  const cart = cartQuery.data?.cart;
  const hasUnavailableItems = cart?.items.some((item) => !item.isAvailable) ?? false;
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const appliedCoupon = coupon.data?.code ?? (couponCode.trim() || undefined);
    if (effectiveAddressId) {
      checkout.mutate({
        addressId: effectiveAddressId,
        ...(appliedCoupon ? { couponCode: appliedCoupon } : {}),
      });
      return;
    }
    void form.handleSubmit((shippingAddress) =>
      checkout.mutate({ shippingAddress, ...(appliedCoupon ? { couponCode: appliedCoupon } : {}) }),
    )(event);
  };

  return (
    <>
      <Helmet>
        <title>Checkout — Veyora</title>
      </Helmet>
      <main className="bg-porcelain min-h-screen px-6 py-8 sm:px-10 lg:px-16">
        <div className="mx-auto w-full max-w-7xl">
          <SiteHeader />
          <section className="py-16">
            <p className="text-champagne text-xs font-semibold tracking-[0.24em] uppercase">
              Secure order creation
            </p>
            <h1 className="font-display mt-5 text-6xl">Checkout</h1>
            {cartQuery.isPending ? (
              <div className="bg-mist mt-12 h-96 animate-pulse rounded-[2rem]" />
            ) : null}
            {cartQuery.isError ? (
              <div className="mt-12 rounded-3xl border border-red-200 bg-red-50 p-8" role="alert">
                {getApiErrorMessage(cartQuery.error)}
              </div>
            ) : null}
            {cart && cart.items.length === 0 ? (
              <div className="border-ink/10 mt-12 rounded-3xl border p-12 text-center">
                <h2 className="font-display text-4xl">Your cart is empty.</h2>
                <Link
                  className="bg-ink mt-7 inline-block rounded-full px-7 py-3 text-xs font-semibold text-white uppercase"
                  to="/products"
                >
                  Browse products
                </Link>
              </div>
            ) : null}
            {cart?.items.length ? (
              <form className="mt-12 grid gap-10 lg:grid-cols-[1fr_24rem]" onSubmit={submit}>
                <div className="border-ink/10 rounded-3xl border bg-white/50 p-6 sm:p-8">
                  <h2 className="font-display text-3xl">Shipping information</h2>
                  {!user ? (
                    <p className="text-ink/55 mt-3 text-sm leading-6">
                      Checking out as a guest. You can place and pay for this order without an
                      account, or{' '}
                      <Link className="underline" to="/login">
                        sign in
                      </Link>{' '}
                      first.
                    </p>
                  ) : null}
                  {addressesQuery.data?.items.length ? (
                    <div className="mt-6 rounded-2xl bg-white p-5">
                      <label
                        className="text-ink/65 text-xs font-semibold tracking-wider uppercase"
                        htmlFor="savedAddress"
                      >
                        Saved address
                      </label>
                      <select
                        className="border-ink/15 mt-2 w-full rounded-xl border px-4 py-3"
                        id="savedAddress"
                        value={effectiveAddressId}
                        onChange={(event) => setSelectedAddressId(event.target.value)}
                      >
                        <option value="">Enter a different address</option>
                        {addressesQuery.data.items.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.label} — {item.fullName}, {item.city}
                          </option>
                        ))}
                      </select>
                      <Link
                        className="text-ink/55 mt-3 inline-block text-xs underline"
                        to="/account/addresses"
                      >
                        Manage addresses
                      </Link>
                    </div>
                  ) : null}
                  {!effectiveAddressId ? (
                    <div className="mt-7 grid gap-5 sm:grid-cols-2">
                      <div className="sm:col-span-2">
                        <FormField
                          autoComplete="name"
                          error={form.formState.errors.fullName?.message}
                          id="checkoutFullName"
                          label="Full name"
                          {...form.register('fullName')}
                        />
                      </div>
                      <FormField
                        autoComplete="tel"
                        error={form.formState.errors.phone?.message}
                        id="checkoutPhone"
                        label="Phone"
                        {...form.register('phone')}
                      />
                      <FormField
                        autoComplete="email"
                        error={form.formState.errors.email?.message}
                        id="checkoutEmail"
                        label="Email"
                        type="email"
                        {...form.register('email')}
                      />
                      <FormField
                        id="checkoutCountry"
                        label="Country"
                        {...form.register('country')}
                      />
                      <FormField
                        id="checkoutProvince"
                        label="Province / state"
                        {...form.register('province')}
                      />
                      <FormField id="checkoutCity" label="City" {...form.register('city')} />
                      <FormField
                        id="checkoutPostalCode"
                        label="Postal code"
                        {...form.register('postalCode')}
                      />
                      <label className="sm:col-span-2">
                        <span className="text-ink/65 text-xs font-semibold tracking-wider uppercase">
                          Complete address
                        </span>
                        <textarea
                          className="border-ink/15 mt-2 min-h-32 w-full rounded-xl border bg-white/80 px-4 py-3"
                          {...form.register('address')}
                        />
                        {form.formState.errors.address?.message ? (
                          <span className="mt-1 block text-sm text-red-700">
                            {form.formState.errors.address.message}
                          </span>
                        ) : null}
                      </label>
                    </div>
                  ) : (
                    <p className="text-ink/55 mt-6 text-sm">
                      The saved address will be copied into an immutable order snapshot.
                    </p>
                  )}
                </div>
                <aside className="h-fit rounded-3xl bg-white/70 p-7 shadow-lg lg:sticky lg:top-8">
                  <h2 className="font-display text-3xl">Order review</h2>
                  <div className="mt-6 space-y-4">
                    {cart.items.map((item) => (
                      <div className="flex justify-between gap-4 text-sm" key={item.id}>
                        <span className="text-ink/60">
                          {item.product.name} × {item.quantity}
                        </span>
                        <span>{formatPrice(item.lineSubtotal, item.currency)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="border-ink/10 mt-6 flex justify-between border-t pt-5">
                    <span>Subtotal</span>
                    <strong>
                      {cart.currency ? formatPrice(cart.subtotal, cart.currency) : '—'}
                    </strong>
                  </div>
                  <div className="mt-5">
                    <label
                      className="text-ink/55 text-xs font-semibold tracking-wider uppercase"
                      htmlFor="couponCode"
                    >
                      Coupon
                    </label>
                    <div className="mt-2 flex gap-2">
                      <input
                        className="border-ink/15 min-w-0 flex-1 rounded-xl border px-3 py-2 text-sm uppercase"
                        id="couponCode"
                        maxLength={64}
                        value={couponCode}
                        onChange={(event) => {
                          setCouponCode(event.target.value);
                          coupon.reset();
                        }}
                      />
                      <button
                        className="border-ink/15 rounded-xl border px-3 text-xs font-semibold uppercase"
                        disabled={!couponCode.trim() || coupon.isPending}
                        onClick={() => coupon.mutate(couponCode)}
                        type="button"
                      >
                        Apply
                      </button>
                    </div>
                    {coupon.isError ? (
                      <p className="mt-2 text-xs text-red-700" role="alert">
                        {getApiErrorMessage(coupon.error)}
                      </p>
                    ) : null}
                    {coupon.data ? (
                      <div className="mt-3 space-y-2 text-sm">
                        <div className="flex justify-between text-emerald-700">
                          <span>{coupon.data.code}</span>
                          <span>
                            − {formatPrice(coupon.data.discountAmount, coupon.data.currency)}
                          </span>
                        </div>
                        <div className="flex justify-between border-t pt-2 font-semibold">
                          <span>Total</span>
                          <span>{formatPrice(coupon.data.total, coupon.data.currency)}</span>
                        </div>
                      </div>
                    ) : null}
                  </div>
                  <p className="text-ink/45 mt-4 text-xs leading-5">
                    Prices, stock, coupon eligibility, and usage limits are revalidated atomically.
                  </p>
                  {hasUnavailableItems ? (
                    <p className="mt-5 rounded-xl bg-red-50 p-3 text-sm text-red-800">
                      Remove unavailable items before checkout.
                    </p>
                  ) : null}
                  {checkout.isError ? (
                    <p className="mt-5 rounded-xl bg-red-50 p-3 text-sm text-red-800" role="alert">
                      {getApiErrorMessage(checkout.error)}
                    </p>
                  ) : null}
                  <button
                    className="bg-ink mt-6 w-full rounded-full px-6 py-3.5 text-xs font-semibold text-white uppercase disabled:opacity-50"
                    disabled={checkout.isPending || hasUnavailableItems}
                    type="submit"
                  >
                    {checkout.isPending ? 'Creating order…' : 'Place order'}
                  </button>
                  <Link className="text-ink/55 mt-4 block text-center text-xs underline" to="/cart">
                    Return to cart
                  </Link>
                </aside>
              </form>
            ) : null}
          </section>
        </div>
      </main>
    </>
  );
};
