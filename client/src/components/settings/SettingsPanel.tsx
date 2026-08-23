import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { SETTINGS_FLAT_CARD } from './SettingsSkeleton';

interface SettingsPanelProps {
  title: string;
  description: string;
  icon: LucideIcon;
  children: ReactNode;
  footer?: ReactNode;
}

export default function SettingsPanel({
  title,
  description,
  icon: Icon,
  children,
  footer,
}: SettingsPanelProps) {
  return (
    <section className={`${SETTINGS_FLAT_CARD} group/settings-panel p-0`}>
      <header className="border-b border-theme-border bg-gradient-to-r from-whatsapp-500/[0.04] via-transparent to-transparent px-4 py-4 sm:px-5">
        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-whatsapp-500/15 to-emerald-500/10 text-whatsapp-600 ring-1 ring-whatsapp-500/20 dark:text-whatsapp-400">
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
