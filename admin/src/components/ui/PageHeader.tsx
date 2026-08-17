import type { KeyboardEvent, ReactNode } from 'react';

export function PageHeader({
  title,
  purpose,
  meta,
  action,
}: {
  title: string;
  purpose: string;
  meta?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">{title}</h1>
        <p className="mt-1 max-w-2xl text-sm text-ink/60">{purpose}</p>
        {meta ? <div className="mt-2">{meta}</div> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function SectionCard({
  title,
  purpose,
  action,
  children,
  padded = false,
}: {
  title?: string;
  purpose?: string;
  action?: ReactNode;
  children: ReactNode;
  padded?: boolean;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-dust bg-white shadow-sm">
      {(title || action) && (
        <div className="flex items-start justify-between gap-3 border-b border-dust px-4 py-3">
          <div className="min-w-0">
            {title && <h2 className="text-sm font-semibold text-ink">{title}</h2>}
            {purpose && <p className="mt-0.5 text-xs text-ink/50">{purpose}</p>}
          </div>
          {action}
        </div>
      )}
      <div className={padded ? 'p-4' : ''}>{children}</div>
    </section>
  );
}

export function PageLoading({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 py-16 text-sm text-ink/55" role="status">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-sage/20 border-t-sage" />
      {label}
    </div>
  );
}

export function FilterPills<T extends string | number>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label={label}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={String(option.value)}
            type="button"
            aria-pressed={selected}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
              selected ? 'bg-sage text-white' : 'border border-dust bg-white text-ink/70 hover:bg-sage-faint'
            }`}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export function clickableRowProps(onOpen: () => void) {
  return {
    tabIndex: 0 as const,
    'data-clickable': 'true',
    onClick: onOpen,
    onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        onOpen();
      }
    },
  };
}
