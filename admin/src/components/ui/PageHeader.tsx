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
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight text-ink">{title}</h1>
        <p className="mt-0.5 max-w-prose text-[13px] leading-snug text-ink/60">{purpose}</p>
        {meta ? <div className="mt-1.5">{meta}</div> : null}
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
    <section className="dashboard-card overflow-hidden">
      {(title || action) && (
        <div className="flex items-start justify-between gap-2 border-b border-dust/80 bg-slate-50/50 px-3 py-2">
          <div className="min-w-0">
            {title && <h2 className="text-[13px] font-semibold text-ink">{title}</h2>}
            {purpose && <p className="mt-0.5 text-[11px] leading-snug text-ink/50">{purpose}</p>}
          </div>
          {action}
        </div>
      )}
      <div className={padded ? 'p-[var(--card-pad)]' : ''}>{children}</div>
    </section>
  );
}

export function PageLoading({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2.5 py-10 text-[13px] text-ink/55" role="status">
      <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-sage/20 border-t-sage" />
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
    <div className="flex flex-wrap gap-1" role="group" aria-label={label}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={String(option.value)}
            type="button"
            aria-pressed={selected}
            className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
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
