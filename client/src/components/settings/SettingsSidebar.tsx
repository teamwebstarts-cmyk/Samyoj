import type { LucideIcon } from 'lucide-react';
import { Settings2 } from 'lucide-react';

export interface SettingsTabItem {
  id: string;
  label: string;
  description: string;
  icon: LucideIcon;
  badge?: string;
}

interface SettingsSidebarProps {
  tabs: SettingsTabItem[];
  activeTab: string;
  onTabChange: (id: string) => void;
  isReady?: boolean;
}

export default function SettingsSidebar({
  tabs,
  activeTab,
  onTabChange,
  isReady = true,
}: SettingsSidebarProps) {
  return (
    <>
      <div className="flex gap-2 overflow-x-auto pb-1 lg:hidden">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTabChange(tab.id)}
              className={`inline-flex shrink-0 items-center gap-2 rounded-full px-3.5 py-2 text-[12px] font-bold transition active:scale-[0.98] ${
                active
                  ? 'bg-gradient-to-r from-whatsapp-600 to-emerald-500 text-white shadow-[0_4px_12px_rgba(37,211,102,0.3)]'
                  : 'border border-theme-border bg-theme-surface text-theme-secondary hover:border-whatsapp-500/30 hover:text-theme-fg'
              }`}
            >
              <Icon className="h-3.5 w-3.5" strokeWidth={2.25} />
              {tab.label}
              {tab.badge && (
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[9px] font-extrabold uppercase ${
                    active
                      ? 'bg-white/20 text-white'
                      : 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
                  }`}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <nav className="hidden lg:block lg:sticky lg:top-6 lg:self-start">
        <div className="dashboard-card overflow-hidden p-0">
          <div className="border-b border-theme-border bg-gradient-to-r from-emerald-500/[0.06] via-transparent to-violet-500/[0.04] px-4 py-3.5">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-whatsapp-500 to-emerald-600 text-white shadow-[0_4px_12px_rgba(37,211,102,0.25)]">
                <Settings2 className="h-3.5 w-3.5" strokeWidth={2.25} />
              </div>
              <div>
                <p className="text-[12px] font-extrabold text-theme-fg">Settings</p>
                <p className="text-[10px] font-medium text-theme-muted">6 areas</p>
              </div>
            </div>
          </div>

          <ul className="space-y-1 p-2">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <li key={tab.id}>
                  <button
                    type="button"
                    onClick={() => onTabChange(tab.id)}
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition ${
                      active
                        ? 'bg-gradient-to-r from-whatsapp-500/12 to-emerald-500/8 text-whatsapp-700 ring-1 ring-whatsapp-500/25 dark:text-whatsapp-400'
                        : 'text-theme-secondary hover:bg-theme-subtle hover:text-theme-fg'
                    }`}
                  >
                    <span
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition ${
                        active
                          ? 'bg-gradient-to-br from-whatsapp-500 to-emerald-600 text-white shadow-[0_4px_12px_rgba(37,211,102,0.25)]'
                          : 'bg-theme-subtle text-theme-muted ring-1 ring-theme-border'
                      }`}
                    >
                      <Icon className="h-4 w-4" strokeWidth={2.25} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="block truncate text-[13px] font-bold">{tab.label}</span>
                        {tab.badge && (
                          <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-extrabold uppercase text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                            {tab.badge}
                          </span>
                        )}
                      </span>
                      <span className="block truncate text-[11px] font-medium text-theme-muted">
                        {tab.description}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          <div className="border-t border-theme-border bg-theme-subtle/40 px-4 py-3">
            <div className="flex items-center gap-2">
              <span
                className={`h-2 w-2 rounded-full ${
                  isReady
                    ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]'
                    : 'bg-amber-400'
                }`}
              />
              <p className="text-[11px] font-semibold text-theme-secondary">
                {isReady ? 'Everything working' : 'Needs attention'}
              </p>
            </div>
          </div>
        </div>
      </nav>
    </>
  );
}
