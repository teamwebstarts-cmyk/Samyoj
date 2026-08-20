import type { KeyboardEvent, ReactNode } from 'react';

export function PageHeader({
  title,
  purpose,
  meta,
  action,
  eyebrow,
}: {
  title: string;
  purpose: string;
  meta?: ReactNode;
  action?: ReactNode;
  eyebrow?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        {eyebrow && <div className="mb-1">{eyebrow}</div>}
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
        <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-slate-600">{purpose}</p>
        {meta ? <div className="mt-2.5">{meta}</div> : null}
      </div>
      {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
    </div>
  );
}

export function SectionCard({
  title,
  purpose,
  action,
  children,
  padded = false,
  className = '',
}: {
  title?: string;
  purpose?: string;
  action?: ReactNode;
  children: ReactNode;
  padded?: boolean;
  className?: string;
}) {
  return (
    <section className={`dashboard-card overflow-hidden ${className}`}>
      {(title || action) && (
        <div className="flex items-center justify-between gap-3 border-b border-slate-200/80 bg-slate-50/60 px-4 py-3">
          <div className="min-w-0">
            {title && <h2 className="text-sm font-semibold tracking-tight text-slate-900">{title}</h2>}
            {purpose && <p className="mt-0.5 text-xs leading-snug text-slate-500">{purpose}</p>}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      <div className={padded ? 'p-4 sm:p-5' : ''}>{children}</div>
    </section>
  );
}

export function PageLoading({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center text-sm text-slate-500" role="status">
      <div className="relative flex h-8 w-8 items-center justify-center">
        <span className="absolute h-8 w-8 animate-ping rounded-full bg-emerald-400/30" />
        <span className="h-6 w-6 animate-spin rounded-full border-2 border-slate-200 border-t-emerald-600" />
      </div>
      <p className="font-medium text-slate-600">{label}</p>
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
    <div className="inline-flex rounded-xl bg-slate-100/90 p-1 border border-slate-200/60 shadow-inner" role="group" aria-label={label}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={String(option.value)}
            type="button"
            aria-pressed={selected}
            className={`rounded-lg px-3 py-1 text-xs font-semibold transition-all ${
              selected
                ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200/80 font-bold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
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
