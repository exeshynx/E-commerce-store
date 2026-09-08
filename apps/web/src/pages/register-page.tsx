import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { AuthShell } from '../components/auth-shell';
import { FormField } from '../components/form-field';
import { getApiErrorMessage } from '../lib/api-error';
import { authApi } from '../lib/auth-api';
import { useAuthStore } from '../stores/auth-store';

const registerFormSchema = z.object({
  email: z.email('Enter a valid email address'),
  firstName: z.string().trim().min(1, 'Enter your first name').max(80),
  lastName: z.string().trim().min(1, 'Enter your last name').max(80),
  password: z
    .string()
    .min(12, 'Use at least 12 characters')
    .regex(/[a-z]/, 'Add a lowercase letter')
    .regex(/[A-Z]/, 'Add an uppercase letter')
    .regex(/\d/, 'Add a number'),
});

type RegisterForm = z.infer<typeof registerFormSchema>;

export const RegisterPage = () => {
  const navigate = useNavigate();
  const form = useForm<RegisterForm>({
    defaultValues: { email: '', firstName: '', lastName: '', password: '' },
    resolver: zodResolver(registerFormSchema),
  });
  const register = useMutation({
    mutationFn: authApi.register,
    onSuccess: (session) => {
      useAuthStore.getState().setSession(session);
      void navigate('/account', { replace: true });
    },
  });

  return (
    <AuthShell
      subtitle="Join Veyora"
      title="Create account"
      footer={
        <>
          Already registered?{' '}
          <Link className="text-ink font-semibold underline underline-offset-4" to="/login">
            Sign in
          </Link>
        </>
      }
    >
      <form
        className="space-y-5"
        onSubmit={(event) => void form.handleSubmit((input) => register.mutate(input))(event)}
      >
        <div className="grid grid-cols-2 gap-4">
          <FormField
            autoComplete="given-name"
            error={form.formState.errors.firstName?.message}
            id="firstName"
            label="First name"
            {...form.register('firstName')}
          />
          <FormField
            autoComplete="family-name"
            error={form.formState.errors.lastName?.message}
            id="lastName"
            label="Last name"
            {...form.register('lastName')}
          />
        </div>
        <FormField
          autoComplete="email"
          error={form.formState.errors.email?.message}
          id="registerEmail"
          label="Email"
          type="email"
          {...form.register('email')}
        />
        <FormField
          autoComplete="new-password"
          error={form.formState.errors.password?.message}
          id="registerPassword"
          label="Password"
          type="password"
          {...form.register('password')}
        />
        <p className="text-ink/45 text-xs leading-5">
          Use at least 12 characters with uppercase, lowercase, and a number.
        </p>
        {register.isError ? (
          <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
            {getApiErrorMessage(register.error)}
          </p>
        ) : null}
        <button
          className="bg-ink w-full rounded-xl px-5 py-3.5 text-sm font-semibold tracking-[0.12em] text-white uppercase transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={register.isPending}
          type="submit"
        >
          {register.isPending ? 'Creating account…' : 'Create account'}
        </button>
      </form>
    </AuthShell>
  );
};
