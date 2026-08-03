import type { ReactNode } from 'react';

/** Soft glass inner card used by details-panel sections (mock-aligned, theme-safe). */
export function DetailsSectionCard({
  children,
  className = '',
  'data-section': dataSection,
}: {
  children: ReactNode;
  className?: string;
  'data-section'?: string;
}) {
  return (
    <section
      data-section={dataSection}
      className={`rounded-2xl border border-white/70 bg-white/55 p-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_rgba(15,23,42,0.04)] backdrop-blur-md dark:border-white/10 dark:bg-neutral-900/55 dark:shadow-[0_1px_2px_rgba(0,0,0,0.35),0_8px_24px_rgba(0,0,0,0.25)] ${className}`}
    >
      {children}
    </section>
  );
}

export function DetailsSectionHeader({
  icon,
  title,
  action,
}: {
  icon?: ReactNode;
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-2.5 flex items-center justify-between gap-2">
      <div className="flex min-w-0 items-center gap-1.5">
        {icon ? (
          <span className="flex h-4 w-4 shrink-0 items-center justify-center text-theme-secondary">
            {icon}
          </span>
        ) : null}
        <p className="truncate text-[13px] font-bold tracking-tight text-theme-fg">{title}</p>
      </div>
      {action}
    </div>
  );
}

export function detailsAddLinkClassName(extra = '') {
  return `shrink-0 text-[12px] font-semibold text-slate-500 transition hover:text-whatsapp-700 dark:text-slate-400 dark:hover:text-whatsapp-400 ${extra}`;
}

/** Soft pastel pill colors from a label hex (mock-like, not neon). */
export function softLabelPillStyle(hex: string): {
  backgroundColor: string;
  color: string;
  borderColor: string;
} {
  const raw = (hex || '#64748b').replace('#', '').trim();
  const full =
    raw.length === 3
      ? raw
          .split('')
          .map((c) => c + c)
          .join('')
      : raw.padEnd(6, '0').slice(0, 6);
  const r = Number.parseInt(full.slice(0, 2), 16) || 100;
  const g = Number.parseInt(full.slice(2, 4), 16) || 116;
  const b = Number.parseInt(full.slice(4, 6), 16) || 139;
  const darken = (n: number) => Math.max(28, Math.min(210, Math.round(n * 0.58)));
  return {
    backgroundColor: `rgba(${r}, ${g}, ${b}, 0.16)`,
    color: `rgb(${darken(r)}, ${darken(g)}, ${darken(b)})`,
    borderColor: `rgba(${r}, ${g}, ${b}, 0.3)`,
  };
}
