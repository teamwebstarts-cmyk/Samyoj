import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { settingsAccentBar } from './settingsUi';

interface SettingsPanelProps {
  title: string;
  description: string;
  icon: LucideIcon;
  accent?: keyof typeof settingsAccentBar;
  children: ReactNode;
  footer?: ReactNode;
}

const accentStyles = {
  emerald: 'from-whatsapp-500 to-emerald-600 shadow-[0_4px_14px_rgba(37,211,102,0.3)]',
  violet: 'from-violet-500 to-purple-600 shadow-[0_4px_14px_rgba(139,92,246,0.3)]',
  sky: 'from-sky-500 to-blue-600 shadow-[0_4px_14px_rgba(14,165,233,0.3)]',
  amber: 'from-amber-500 to-orange-500 shadow-[0_4px_14px_rgba(245,158,11,0.3)]',
  indigo: 'from-indigo-500 to-violet-600 shadow-[0_4px_14px_rgba(99,102,241,0.3)]',
  rose: 'from-rose-500 to-pink-600 shadow-[0_4px_14px_rgba(244,63,94,0.3)]',
};

export default function SettingsPanel({
  title,
  description,
  icon: Icon,
  accent = 'emerald',
  children,
  footer,
}: SettingsPanelProps) {
  return (
    <section className="dashboard-card group/settings-panel overflow-hidden p-0 transition hover:shadow-panel">
      <div className={`h-0.5 bg-gradient-to-r ${settingsAccentBar[accent]}`} />

      <header className="relative overflow-hidden border-b border-theme-border bg-gradient-to-br from-theme-subtle/80 via-theme-surface to-transparent px-4 py-4 sm:px-5">
        <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-theme-subtle opacity-60 blur-2xl" />
        <div className="relative flex items-start gap-4">
          <div
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br text-white ${accentStyles[accent]}`}
          >
            <Icon className="h-5 w-5" strokeWidth={2.25} />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-[17px] font-extrabold tracking-tight text-theme-fg">{title}</h2>
            <p className="mt-1 text-[12px] font-medium leading-relaxed text-theme-secondary">
              {description}
            </p>
          </div>
        </div>
      </header>

      <div className="p-4 sm:p-5">{children}</div>

      {footer && (
        <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-theme-border bg-theme-subtle/30 px-4 py-3.5 backdrop-blur-sm sm:px-5">
          {footer}
        </footer>
      )}
    </section>
  );
}
