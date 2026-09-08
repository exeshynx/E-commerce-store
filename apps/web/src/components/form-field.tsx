import type { InputHTMLAttributes } from 'react';

type FormFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  error?: string | undefined;
  label: string;
};

export const FormField = ({ error, id, label, ...inputProps }: FormFieldProps) => (
  <label className="block" htmlFor={id}>
    <span className="text-ink/65 text-xs font-semibold tracking-[0.14em] uppercase">{label}</span>
    <input
      {...inputProps}
      className="border-ink/15 text-ink placeholder:text-ink/30 focus:border-champagne mt-2 w-full rounded-xl border bg-white/80 px-4 py-3 transition"
      id={id}
      aria-invalid={Boolean(error)}
      aria-describedby={error ? `${id}-error` : undefined}
    />
    {error ? (
      <span className="mt-1.5 block text-sm text-red-700" id={`${id}-error`} role="alert">
        {error}
      </span>
    ) : null}
  </label>
);
