import type { LucideIcon } from 'lucide-react';

export interface SettingsNavItem {
  id: string;
  label: string;
  hint?: string;
  icon: LucideIcon;
  group?: string;
}

interface SettingsSidebarProps {
  tabs: SettingsNavItem[];
  activeTab: string;
  onTabChange: (id: string) => void;
}

export default function SettingsSidebar({ tabs, activeTab, onTabChange }: SettingsSidebarProps) {
  return (
    <>
      {/* Compact pill scroller for narrow screens */}
      <nav
        className="flex gap-2 overflow-x-auto pb-1 lg:hidden"
        aria-label="Settings sections"
      >
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTabChange(tab.id)}
              aria-current={active ? 'page' : undefined}
              className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-2 text-[12px] font-bold transition ${
                active
                  ? 'bg-gradient-to-br from-whatsapp-500 to-emerald-600 text-white'
                  : 'bg-theme-subtle text-theme-secondary ring-1 ring-theme-border hover:bg-whatsapp-500/5 hover:text-theme-fg'
              }`}
            >
              <Icon className="h-3.5 w-3.5" strokeWidth={2.25} />
              {tab.label}
            </button>
          );
        })}
      </nav>

      {/* Left rail for desktop */}
      <nav className="hidden w-[16rem] shrink-0 lg:block" aria-label="Settings sections">
        <div
          className="sticky top-6 rounded-2xl border border-whatsapp-500/10 bg-theme-surface/80 p-3 shadow-none backdrop-blur-sm"
          role="tablist"
        >
          <ul className="space-y-2">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <li key={tab.id}>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => onTabChange(tab.id)}
                    className={`flex w-full items-start gap-2.5 rounded-xl px-2.5 py-2 text-left transition ${
                      active
                        ? 'bg-whatsapp-500/10 ring-1 ring-whatsapp-500/25'
                        : 'hover:bg-whatsapp-500/5'
                    }`}
                  >
                    <span
                      className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition ${
                        active
                          ? 'bg-gradient-to-br from-whatsapp-500 to-emerald-600 text-white'
                          : 'bg-theme-subtle text-theme-muted ring-1 ring-theme-border'
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5" strokeWidth={2.25} />
                    </span>
                    <span className="min-w-0 flex-1 pt-0.5">
                      <span
                        className={`block text-[12px] font-semibold leading-none ${
                          active
                            ? 'text-whatsapp-800 dark:text-whatsapp-300'
                            : 'text-theme-fg'
                        }`}
                      >
                        {tab.label}
                      </span>
                      {tab.hint && (
                        <span className="mt-1 block line-clamp-2 text-[9px] font-medium leading-[1.3] text-theme-muted">
                          {tab.hint}
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </nav>
    </>
  );
}
