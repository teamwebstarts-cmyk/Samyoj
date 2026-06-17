import type { LucideIcon } from 'lucide-react';
import { CheckCircle2, XCircle } from 'lucide-react';

interface SettingsStatusPillProps {
  label: string;
  active: boolean;
  icon: LucideIcon;
  activeLabel?: string;
  inactiveLabel?: string;
}

export default function SettingsStatusPill({
  label,
  active,
  icon: Icon,
  activeLabel = 'Active',
  inactiveLabel = 'Inactive',
}: SettingsStatusPillProps) {
  return (
    <div
      className={`relative overflow-hidden rounded-2xl border px-4 py-3.5 transition ${
        active
          ? 'border-emerald-200/80 bg-gradient-to-br from-emerald-50/90 via-white to-teal-50/40 ring-1 ring-emerald-100 dark:border-emerald-800/40 dark:from-emerald-950/30 dark:via-theme-surface dark:to-teal-950/10 dark:ring-emerald-900/40'
          : 'border-theme-border bg-theme-subtle/50'
      }`}
    >
      {active && (
        <div className="pointer-events-none absolute -right-4 -top-4 h-16 w-16 rounded-full bg-emerald-400/10 blur-xl" />
      )}
      <div className="relative flex items-center gap-3">
        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
            active
              ? 'bg-gradient-to-br from-whatsapp-600 to-emerald-700 text-white shadow-[0_4px_12px_rgba(37,211,102,0.25)]'
              : 'bg-theme-surface text-theme-muted ring-1 ring-theme-border'
          }`}
        >
          <Icon className="h-4 w-4" strokeWidth={2.25} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-extrabold text-theme-fg">{label}</p>
          <p
            className={`text-[11px] font-semibold ${
              active ? 'text-whatsapp-700 dark:text-whatsapp-400' : 'text-theme-muted'
            }`}
          >
            {active ? activeLabel : inactiveLabel}
          </p>
        </div>
        <span
          className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
            active
              ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/50 dark:text-emerald-300'
              : 'bg-theme-subtle text-theme-muted'
          }`}
        >
          {active ? (
            <CheckCircle2 className="h-3.5 w-3.5" />
          ) : (
            <XCircle className="h-3.5 w-3.5 opacity-60" />
          )}
        </span>
      </div>
    </div>
  );
}
