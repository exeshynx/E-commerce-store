import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { AuthShell } from '../components/auth-shell';
import { FormField } from '../components/form-field';
import { getApiErrorMessage } from '../lib/api-error';
import { authApi } from '../lib/auth-api';
import { useAuthStore } from '../stores/auth-store';

const loginFormSchema = z.object({
  email: z.email('Enter a valid email address'),
  password: z.string().min(1, 'Enter your password'),
});

type LoginForm = z.infer<typeof loginFormSchema>;

const getRequestedPath = (state: unknown) => {
  if (!state || typeof state !== 'object' || !('from' in state)) return '/account';
  const from = state.from;
  return typeof from === 'string' && from.startsWith('/') && !from.startsWith('//')
    ? from
    : '/account';
};

export const LoginPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const requestedPath = getRequestedPath(location.state as unknown);
  const form = useForm<LoginForm>({
    defaultValues: { email: '', password: '' },
    resolver: zodResolver(loginFormSchema),
  });
  const login = useMutation({
    mutationFn: authApi.login,
    onSuccess: (session) => {
      useAuthStore.getState().setSession(session);
      void navigate(requestedPath, { replace: true });
    },
  });

  return (
    <AuthShell
      subtitle="Welcome back"
      title="Sign in"
      footer={
        <>
          New to Veyora?{' '}
          <Link className="text-ink font-semibold underline underline-offset-4" to="/register">
            Create an account
          </Link>
        </>
      }
    >
      <form
        className="space-y-5"
        onSubmit={(event) => void form.handleSubmit((input) => login.mutate(input))(event)}
      >
        <FormField
          autoComplete="email"
          error={form.formState.errors.email?.message}
          id="email"
          label="Email"
          type="email"
          {...form.register('email')}
        />
        <FormField
          autoComplete="current-password"
          error={form.formState.errors.password?.message}
          id="password"
          label="Password"
          type="password"
          {...form.register('password')}
        />
        {login.isError ? (
          <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
            {getApiErrorMessage(login.error)}
          </p>
        ) : null}
        <button
          className="bg-ink w-full rounded-xl px-5 py-3.5 text-sm font-semibold tracking-[0.12em] text-white uppercase transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={login.isPending}
          type="submit"
        >
          {login.isPending ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </AuthShell>
  );
};
