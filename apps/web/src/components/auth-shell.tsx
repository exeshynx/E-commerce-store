import type { PropsWithChildren, ReactNode } from 'react';
import { Link } from 'react-router-dom';

type AuthShellProps = PropsWithChildren<{
  footer: ReactNode;
  subtitle: string;
  title: string;
}>;

export const AuthShell = ({ children, footer, subtitle, title }: AuthShellProps) => (
  <main className="bg-porcelain relative grid min-h-screen place-items-center overflow-hidden px-6 py-12">
    <div
      className="bg-champagne/15 pointer-events-none absolute -top-48 right-[-12rem] size-[36rem] rounded-full blur-3xl"
      aria-hidden="true"
    />
    <section className="relative w-full max-w-md rounded-[2rem] border border-white/80 bg-white/65 p-8 shadow-[0_24px_80px_rgba(65,50,30,0.09)] backdrop-blur-xl sm:p-10">
      <Link className="font-display text-xl tracking-[0.12em]" to="/" aria-label="Veyora home">
        VEYORA
      </Link>
      <p className="text-champagne mt-12 text-xs font-semibold tracking-[0.24em] uppercase">
        {subtitle}
      </p>
      <h1 className="font-display mt-4 text-5xl leading-tight">{title}</h1>
      <div className="mt-9">{children}</div>
      <div className="text-ink/55 mt-8 text-center text-sm">{footer}</div>
    </section>
  </main>
);
