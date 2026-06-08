import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

const calloutAccents: Record<string, string> = {
  violet:
    'border-violet-200/70 bg-gradient-to-br from-violet-500/10 via-theme-surface to-indigo-500/5 dark:border-violet-500/25',
  sky: 'border-sky-200/70 bg-gradient-to-br from-sky-500/10 via-theme-surface to-blue-500/5 dark:border-sky-500/25',
  emerald:
    'border-emerald-200/70 bg-gradient-to-br from-emerald-500/10 via-theme-surface to-teal-500/5 dark:border-emerald-500/25',
  indigo:
    'border-indigo-200/70 bg-gradient-to-br from-indigo-500/10 via-theme-surface to-violet-500/5 dark:border-indigo-500/25',
  amber:
    'border-amber-200/70 bg-gradient-to-br from-amber-500/10 via-theme-surface to-orange-500/5 dark:border-amber-500/25',
  neutral: 'border-theme-border bg-theme-subtle/50',
};

const iconAccents: Record<string, string> = {
  violet: 'bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-[0_4px_14px_rgba(99,102,241,0.35)]',
  sky: 'bg-gradient-to-br from-sky-500 to-blue-600 text-white shadow-[0_4px_14px_rgba(14,165,233,0.3)]',
  emerald:
    'bg-gradient-to-br from-whatsapp-500 to-emerald-600 text-white shadow-[0_4px_14px_rgba(37,211,102,0.35)]',
  indigo: 'bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-[0_4px_14px_rgba(99,102,241,0.35)]',
  amber: 'bg-gradient-to-br from-amber-500 to-orange-500 text-white shadow-[0_4px_14px_rgba(245,158,11,0.35)]',
  neutral: 'bg-theme-subtle text-theme-secondary ring-1 ring-theme-border',
};

export function ModalCallout({
  icon: Icon,
  title,
  description,
  accent = 'violet',
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  accent?: keyof typeof calloutAccents;
}) {
  return (
    <div className={`overflow-hidden rounded-2xl border p-4 ${calloutAccents[accent]}`}>
      <div className="flex items-start gap-3">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${iconAccents[accent]}`}
        >
          <Icon className="h-4 w-4" strokeWidth={2.25} />
        </div>
        <div>
          <p className="text-[13px] font-extrabold text-theme-fg">{title}</p>
          <p className="mt-1 text-[12px] font-medium leading-relaxed text-theme-secondary">{description}</p>
        </div>
      </div>
    </div>
  );
}

export function ModalSection({
  step,
  title,
  subtitle,
  children,
}: {
  step?: number | string;
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div className="flex items-start gap-3">
        {step !== undefined && (
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-[11px] font-black text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">
            {step}
          </span>
        )}
        <div>
          <h3 className="text-[13px] font-extrabold tracking-tight text-theme-fg">{title}</h3>
          {subtitle && <p className="mt-0.5 text-[12px] font-medium text-theme-secondary">{subtitle}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

export function ModalPanel({
  title,
  icon: Icon,
  children,
  accent = 'neutral',
}: {
  title?: string;
  icon?: LucideIcon;
  children: ReactNode;
  accent?: keyof typeof calloutAccents;
}) {
  return (
    <div className={`overflow-hidden rounded-2xl border ${calloutAccents[accent]}`}>
      {title && (
        <div className="flex items-center gap-2 border-b border-theme-border/60 px-4 py-3">
          {Icon && <Icon className="h-4 w-4 text-theme-secondary" strokeWidth={2.25} />}
          <p className="text-[12px] font-extrabold uppercase tracking-wide text-theme-secondary">{title}</p>
        </div>
      )}
      <div className="p-4">{children}</div>
    </div>
  );
}

export function ModalPreviewCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-2xl ring-1 ring-theme-border">
      <div className="border-b border-theme-border bg-theme-subtle/80 px-4 py-2.5">
        <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-theme-muted">{title}</p>
      </div>
      {children}
    </div>
  );
}

export function ModalStatusSummary({
  enabled,
  isDefault,
  businessHoursOnly,
}: {
  enabled: boolean;
  isDefault: boolean;
  businessHoursOnly: boolean;
}) {
  const items = [
    {
      label: 'Bot status',
      value: enabled ? 'ON' : 'OFF',
      tone: enabled ? 'live' : 'muted',
    },
    {
      label: 'Default handler',
      value: isDefault ? 'Yes' : 'No',
      tone: isDefault ? 'live' : 'muted',
    },
    {
      label: 'Business hours',
      value: businessHoursOnly ? 'Restricted' : 'Always',
      tone: businessHoursOnly ? 'warn' : 'live',
    },
  ] as const;

  const toneStyles = {
    live: 'bg-emerald-100 text-emerald-800 ring-emerald-200/70 dark:bg-emerald-900/40 dark:text-emerald-300',
    warn: 'bg-amber-100 text-amber-800 ring-amber-200/70 dark:bg-amber-900/40 dark:text-amber-300',
    muted: 'bg-theme-subtle text-theme-muted ring-theme-border',
  };

  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div
          key={item.label}
          className="flex items-center justify-between rounded-xl bg-theme-subtle/60 px-3 py-2.5 ring-1 ring-theme-border"
        >
          <span className="text-[12px] font-medium text-theme-secondary">{item.label}</span>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ${toneStyles[item.tone]}`}
          >
            {item.tone === 'live' && <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />}
            {item.value}
          </span>
        </div>
      ))}
    </div>
  );
}

export function ModalEmptyHint({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-dashed border-theme-border bg-theme-subtle/40 px-4 py-6 text-center">
      <p className="text-[13px] font-medium text-theme-secondary">{message}</p>
    </div>
  );
}
