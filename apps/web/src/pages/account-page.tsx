import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { FormField } from '../components/form-field';
import { SiteHeader } from '../components/site-header';
import { accountApi, accountQueryKeys } from '../lib/account-api';
import { getApiErrorMessage } from '../lib/api-error';
import { authApi } from '../lib/auth-api';
import { formatPrice } from '../lib/format-price';
import { useAuthStore } from '../stores/auth-store';

export const AccountPage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const [profile, setProfile] = useState({
    avatarAltText: user?.avatarAltText ?? '',
    avatarUrl: user?.avatarUrl ?? '',
    firstName: user?.firstName ?? '',
    lastName: user?.lastName ?? '',
    phone: user?.phone ?? '',
  });
  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '' });
  const summary = useQuery({ queryFn: accountApi.getSummary, queryKey: accountQueryKeys.summary });

  const saveProfile = useMutation({
    mutationFn: accountApi.updateProfile,
    onSuccess: async (updated) => {
      useAuthStore.getState().setUser(updated);
      await queryClient.invalidateQueries({ queryKey: accountQueryKeys.summary });
      toast.success('Profile updated.');
    },
  });
  const changePassword = useMutation({
    mutationFn: accountApi.changePassword,
    onSuccess: () => {
      useAuthStore.getState().clearSession();
      toast.success('Password changed. Sign in again on your other devices.');
      void navigate('/login', { replace: true });
    },
  });
  const logout = useMutation({
    mutationFn: authApi.logout,
    onSettled: () => {
      useAuthStore.getState().clearSession();
      void navigate('/login', { replace: true });
    },
  });

  if (!user) return null;
  const stats = summary.data?.stats;
  const submitProfile = (event: FormEvent) => {
    event.preventDefault();
    saveProfile.mutate({
      avatarAltText: profile.avatarAltText.trim() || null,
      avatarUrl: profile.avatarUrl.trim() || null,
      firstName: profile.firstName,
      lastName: profile.lastName,
      phone: profile.phone.trim() || null,
    });
  };

  return (
    <>
      <Helmet>
        <title>Account — Veyora</title>
      </Helmet>
      <main className="bg-porcelain min-h-screen px-6 py-8 sm:px-10 lg:px-16">
        <div className="mx-auto w-full max-w-6xl">
          <SiteHeader />
          <section className="py-14 sm:py-20">
            <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
              <div>
                <p className="text-champagne text-xs font-semibold tracking-[0.24em] uppercase">
                  Your account
                </p>
                <h1 className="font-display mt-4 text-5xl sm:text-6xl">
                  Welcome, {user.firstName}.
                </h1>
              </div>
              <button
                className="text-sm font-semibold underline"
                disabled={logout.isPending}
                onClick={() => logout.mutate()}
                type="button"
              >
                {logout.isPending ? 'Signing out…' : 'Sign out'}
              </button>
            </div>

            {summary.isPending ? (
              <div className="bg-mist mt-10 h-36 animate-pulse rounded-3xl" />
            ) : null}
            {summary.isError ? (
              <p className="mt-8 rounded-xl bg-red-50 p-4 text-red-800" role="alert">
                {getApiErrorMessage(summary.error)}
              </p>
            ) : null}
            {stats ? (
              <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  ['Delivered orders', stats.deliveredOrderCount],
                  ['Lifetime spend', formatPrice(stats.deliveredOrderSpend, 'PKR')],
                  ['Wishlist items', stats.wishlistItemCount],
                  ['Saved addresses', stats.addressCount],
                  ['Returns', `${stats.openReturnCount} active / ${stats.returnCount} total`],
                  [
                    'Support',
                    `${stats.openSupportTicketCount} open / ${stats.supportTicketCount} total`,
                  ],
                ].map(([label, value]) => (
                  <article
                    className="border-ink/10 rounded-2xl border bg-white/70 p-5"
                    key={String(label)}
                  >
                    <p className="text-ink/45 text-xs tracking-wider uppercase">{label}</p>
                    <p className="font-display mt-2 text-2xl">{value}</p>
                  </article>
                ))}
              </div>
            ) : null}

            <nav className="mt-8 flex flex-wrap gap-3" aria-label="Account shortcuts">
              <Link
                className="border-ink/15 rounded-full border px-5 py-2 text-sm"
                to="/account/addresses"
              >
                Saved addresses
              </Link>
              <Link className="border-ink/15 rounded-full border px-5 py-2 text-sm" to="/orders">
                Orders
              </Link>
              <Link className="border-ink/15 rounded-full border px-5 py-2 text-sm" to="/returns">
                Returns
              </Link>
              <Link className="border-ink/15 rounded-full border px-5 py-2 text-sm" to="/support">
                Support
              </Link>
            </nav>

            <div className="mt-12 grid gap-8 lg:grid-cols-2">
              <form
                className="border-ink/10 rounded-3xl border bg-white/60 p-6 sm:p-8"
                onSubmit={submitProfile}
              >
                <h2 className="font-display text-3xl">Profile</h2>
                <p className="text-ink/50 mt-2 text-sm">
                  Email changes require a separate verified workflow and remain disabled.
                </p>
                <div className="mt-6 grid gap-5 sm:grid-cols-2">
                  <FormField
                    id="profileFirstName"
                    label="First name"
                    maxLength={80}
                    required
                    value={profile.firstName}
                    onChange={(event) =>
                      setProfile((current) => ({ ...current, firstName: event.target.value }))
                    }
                  />
                  <FormField
                    id="profileLastName"
                    label="Last name"
                    maxLength={80}
                    required
                    value={profile.lastName}
                    onChange={(event) =>
                      setProfile((current) => ({ ...current, lastName: event.target.value }))
                    }
                  />
                  <FormField
                    id="profilePhone"
                    label="Phone"
                    maxLength={32}
                    value={profile.phone}
                    onChange={(event) =>
                      setProfile((current) => ({ ...current, phone: event.target.value }))
                    }
                  />
                  <FormField
                    id="profileAvatarAlt"
                    label="Avatar description"
                    maxLength={160}
                    value={profile.avatarAltText}
                    onChange={(event) =>
                      setProfile((current) => ({ ...current, avatarAltText: event.target.value }))
                    }
                  />
                  <div className="sm:col-span-2">
                    <FormField
                      id="profileAvatarUrl"
                      label="Avatar URL metadata"
                      maxLength={500}
                      type="url"
                      value={profile.avatarUrl}
                      onChange={(event) =>
                        setProfile((current) => ({ ...current, avatarUrl: event.target.value }))
                      }
                    />
                  </div>
                </div>
                {saveProfile.isError ? (
                  <p className="mt-4 text-sm text-red-700" role="alert">
                    {getApiErrorMessage(saveProfile.error)}
                  </p>
                ) : null}
                <button
                  className="bg-ink mt-6 rounded-full px-6 py-3 text-xs font-semibold text-white uppercase disabled:opacity-40"
                  disabled={saveProfile.isPending}
                  type="submit"
                >
                  {saveProfile.isPending ? 'Saving…' : 'Save profile'}
                </button>
              </form>

              <form
                className="border-ink/10 rounded-3xl border bg-white/60 p-6 sm:p-8"
                onSubmit={(event) => {
                  event.preventDefault();
                  changePassword.mutate(passwords);
                }}
              >
                <h2 className="font-display text-3xl">Change password</h2>
                <p className="text-ink/50 mt-2 text-sm">
                  Changing it revokes every active session for account safety.
                </p>
                <div className="mt-6 space-y-5">
                  <FormField
                    id="currentPassword"
                    label="Current password"
                    type="password"
                    required
                    value={passwords.currentPassword}
                    onChange={(event) =>
                      setPasswords((current) => ({
                        ...current,
                        currentPassword: event.target.value,
                      }))
                    }
                  />
                  <FormField
                    id="newPassword"
                    label="New password"
                    minLength={12}
                    maxLength={128}
                    type="password"
                    required
                    value={passwords.newPassword}
                    onChange={(event) =>
                      setPasswords((current) => ({ ...current, newPassword: event.target.value }))
                    }
                  />
                </div>
                {changePassword.isError ? (
                  <p className="mt-4 text-sm text-red-700" role="alert">
                    {getApiErrorMessage(changePassword.error)}
                  </p>
                ) : null}
                <button
                  className="bg-ink mt-6 rounded-full px-6 py-3 text-xs font-semibold text-white uppercase disabled:opacity-40"
                  disabled={changePassword.isPending}
                  type="submit"
                >
                  Change password
                </button>
              </form>
            </div>
          </section>
        </div>
      </main>
    </>
  );
};
