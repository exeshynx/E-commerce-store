import { useVirtualizer } from '@tanstack/react-virtual';
import { useId, useRef, type FormEvent, type PropsWithChildren, type ReactNode } from 'react';
import { FiAlertCircle, FiInbox, FiSearch, FiX } from 'react-icons/fi';
import { useDialogFocus } from '../../hooks/use-dialog-focus';

export const AdminPageHeader = ({
  actions,
  description,
  eyebrow,
  title,
}: {
  actions?: ReactNode;
  description: string;
  eyebrow: string;
  title: string;
}) => (
  <header className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
    <div>
      <p className="text-champagne text-xs font-bold tracking-[0.2em] uppercase">{eyebrow}</p>
      <h1 className="font-display mt-2 text-4xl sm:text-5xl">{title}</h1>
      <p className="text-ink/55 mt-2 max-w-2xl text-sm leading-6">{description}</p>
    </div>
    {actions ? <div className="shrink-0">{actions}</div> : null}
  </header>
);

export const AdminTable = ({
  ariaLabel = 'Administration data',
  children,
  minWidth = '52rem',
}: PropsWithChildren<{ ariaLabel?: string; minWidth?: string }>) => (
  <div
    aria-label={`${ariaLabel}. Scroll horizontally when needed.`}
    className="border-ink/10 overflow-x-auto rounded-2xl border bg-white shadow-sm"
    role="region"
    tabIndex={0}
  >
    <table
      aria-label={ariaLabel}
      className="w-full border-collapse text-left text-sm"
      style={{ minWidth }}
    >
      {children}
    </table>
  </div>
);

export const AdminTableHead = ({ children }: PropsWithChildren) => (
  <thead className="bg-mist/60 text-ink/55 text-xs tracking-[0.1em] uppercase">{children}</thead>
);

export const AdminPagination = ({
  isFetching,
  onPageChange,
  page,
  totalPages,
}: {
  isFetching?: boolean;
  onPageChange: (page: number) => void;
  page: number;
  totalPages: number;
}) => (
  <nav className="flex items-center justify-between gap-4" aria-label="Pagination">
    <button
      aria-label={`Go to page ${Math.max(1, page - 1)}`}
      className="border-ink/15 rounded-xl border bg-white px-4 py-2 text-xs font-semibold uppercase disabled:opacity-35"
      disabled={page <= 1 || isFetching}
      onClick={() => onPageChange(page - 1)}
      type="button"
    >
      Previous
    </button>
    <span aria-live="polite" className="text-ink/50 text-sm">
      Page {page} of {Math.max(1, totalPages)}
    </span>
    <button
      aria-label={`Go to page ${Math.min(Math.max(1, totalPages), page + 1)}`}
      className="border-ink/15 rounded-xl border bg-white px-4 py-2 text-xs font-semibold uppercase disabled:opacity-35"
      disabled={page >= totalPages || isFetching}
      onClick={() => onPageChange(page + 1)}
      type="button"
    >
      Next
    </button>
  </nav>
);

export const AdminSearchBar = ({
  onChange,
  onSubmit,
  placeholder,
  value,
}: {
  onChange: (value: string) => void;
  onSubmit: () => void;
  placeholder: string;
  value: string;
}) => {
  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit();
  };
  return (
    <form className="flex min-w-0 flex-1 gap-2" onSubmit={submit} role="search">
      <label className="relative min-w-0 flex-1">
        <span className="sr-only">Search</span>
        <FiSearch className="text-ink/35 absolute top-1/2 left-4 -translate-y-1/2" />
        <input
          className="border-ink/15 w-full rounded-xl border bg-white py-2.5 pr-4 pl-11 text-sm"
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          value={value}
        />
      </label>
      <button
        className="bg-ink rounded-xl px-4 text-xs font-semibold text-white uppercase"
        type="submit"
      >
        Search
      </button>
    </form>
  );
};

export const AdminLoadingState = ({ rows = 4 }: { rows?: number }) => (
  <div className="space-y-3" aria-label="Loading" aria-live="polite">
    {Array.from({ length: rows }, (_, index) => (
      <div className="bg-mist h-16 animate-pulse rounded-xl" key={index} />
    ))}
  </div>
);

export const AdminErrorState = ({ message, retry }: { message: string; retry?: () => void }) => (
  <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-900" role="alert">
    <div className="flex items-start gap-3">
      <FiAlertCircle className="mt-0.5 shrink-0" />
      <div>
        <p className="font-semibold">This information could not be loaded.</p>
        <p className="mt-1 text-sm">{message}</p>
        {retry ? (
          <button className="mt-3 text-sm font-semibold underline" onClick={retry} type="button">
            Try again
          </button>
        ) : null}
      </div>
    </div>
  </div>
);

export const AdminEmptyState = ({ message, title }: { message: string; title: string }) => (
  <div className="border-ink/10 rounded-2xl border bg-white p-10 text-center">
    <FiInbox className="text-champagne mx-auto text-3xl" />
    <h2 className="font-display mt-3 text-2xl">{title}</h2>
    <p className="text-ink/50 mt-2 text-sm">{message}</p>
  </div>
);

export const AdminBadge = ({
  children,
  tone = 'neutral',
}: PropsWithChildren<{ tone?: 'good' | 'neutral' | 'warning' | 'danger' }>) => {
  const tones = {
    danger: 'bg-red-100 text-red-800',
    good: 'bg-emerald-100 text-emerald-800',
    neutral: 'bg-stone-100 text-stone-700',
    warning: 'bg-amber-100 text-amber-800',
  };
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-[0.65rem] font-bold tracking-[0.08em] uppercase ${tones[tone]}`}
    >
      {children}
    </span>
  );
};

export const StatCard = ({
  hint,
  label,
  value,
}: {
  hint?: string;
  label: string;
  value: ReactNode;
}) => (
  <article className="border-ink/10 rounded-2xl border bg-white p-5 shadow-sm">
    <p className="text-ink/50 text-xs font-semibold tracking-[0.12em] uppercase">{label}</p>
    <p className="font-display mt-3 text-4xl">{value}</p>
    {hint ? <p className="text-ink/45 mt-2 text-xs">{hint}</p> : null}
  </article>
);

export const AdminModal = ({
  children,
  onClose,
  title,
}: PropsWithChildren<{ onClose: () => void; title: string }>) => {
  const titleId = useId();
  const dialogRef = useDialogFocus<HTMLElement>({ active: true, onClose });

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/45 p-4"
      role="presentation"
    >
      <section
        aria-labelledby={titleId}
        aria-modal="true"
        className="my-8 w-full max-w-3xl rounded-2xl bg-white shadow-2xl"
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
      >
        <header className="border-ink/10 flex items-center justify-between border-b px-6 py-4">
          <h2 className="font-display text-2xl" id={titleId}>
            {title}
          </h2>
          <button
            aria-label="Close dialog"
            className="hover:bg-mist rounded-full p-2"
            onClick={onClose}
            type="button"
          >
            <FiX />
          </button>
        </header>
        <div className="p-6">{children}</div>
      </section>
    </div>
  );
};

export const AdminVirtualizedList = <Item,>({
  ariaLabel,
  estimateSize = 180,
  items,
  renderItem,
}: {
  ariaLabel: string;
  estimateSize?: number;
  items: Item[];
  renderItem: (item: Item) => ReactNode;
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  // TanStack Virtual owns mutable measurement functions; the React Compiler
  // intentionally leaves this hook-managed component un-memoized.
  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({
    count: items.length,
    estimateSize: () => estimateSize,
    getScrollElement: () => scrollRef.current,
    overscan: 4,
  });

  return (
    <div
      aria-label={ariaLabel}
      className="max-h-[38rem] overflow-y-auto overscroll-contain"
      ref={scrollRef}
      role="region"
      tabIndex={0}
    >
      <div className="relative w-full" style={{ height: virtualizer.getTotalSize() }}>
        {virtualizer.getVirtualItems().map((virtualRow) => (
          <div
            className="absolute top-0 left-0 w-full pb-3"
            data-index={virtualRow.index}
            key={virtualRow.key}
            ref={virtualizer.measureElement}
            style={{ transform: `translateY(${virtualRow.start}px)` }}
          >
            {renderItem(items[virtualRow.index]!)}
          </div>
        ))}
      </div>
    </div>
  );
};

export const ConfirmDialog = ({
  confirmLabel,
  description,
  isPending,
  onCancel,
  onConfirm,
  title,
}: {
  confirmLabel: string;
  description: string;
  isPending?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  title: string;
}) => (
  <AdminModal onClose={onCancel} title={title}>
    <p className="text-ink/60 leading-6">{description}</p>
    <div className="mt-6 flex justify-end gap-3">
      <button
        className="border-ink/15 rounded-xl border px-4 py-2"
        onClick={onCancel}
        type="button"
      >
        Cancel
      </button>
      <button
        className="rounded-xl bg-red-700 px-4 py-2 font-semibold text-white disabled:opacity-50"
        disabled={isPending}
        onClick={onConfirm}
        type="button"
      >
        {isPending ? 'Working…' : confirmLabel}
      </button>
    </div>
  </AdminModal>
);
