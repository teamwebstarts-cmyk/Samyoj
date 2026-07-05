import type { LucideIcon } from 'lucide-react';
import { ChevronDown, Settings2 } from 'lucide-react';

export interface SettingsTabItem {
  id: string;
  label: string;
  description: string;
  icon: LucideIcon;
  badge?: string;
  group?: string;
}

interface SettingsSidebarProps {
  tabs: SettingsTabItem[];
  activeTab: string;
  onTabChange: (id: string) => void;
  isReady?: boolean;
}

function groupTabs(tabs: SettingsTabItem[]): Array<{ group: string; items: SettingsTabItem[] }> {
  const groups: Array<{ group: string; items: SettingsTabItem[] }> = [];
  for (const tab of tabs) {
    const groupName = tab.group || 'General';
    const existing = groups.find((g) => g.group === groupName);
    if (existing) existing.items.push(tab);
    else groups.push({ group: groupName, items: [tab] });
  }
  return groups;
}

export default function SettingsSidebar({
  tabs,
  activeTab,
  onTabChange,
  isReady = true,
}: SettingsSidebarProps) {
  const grouped = groupTabs(tabs);

  return (
    <>
      <nav className="space-y-4 lg:hidden" aria-label="Settings sections">
        {grouped.map(({ group, items }) => (
          <div key={group}>
            <p className="mb-1.5 px-1 text-micro font-bold uppercase tracking-wider text-theme-muted">
              {group}
            </p>
            <div className="space-y-1">
              {items.map((tab) => {
                const Icon = tab.icon;
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => onTabChange(tab.id)}
                    aria-current={active ? 'page' : undefined}
                    className={`flex w-full min-h-[44px] items-center gap-3 rounded-xl border px-3 py-3 text-left transition active:scale-[0.98] ${
                      active
                        ? 'border-whatsapp-500/30 bg-whatsapp-500/10 text-whatsapp-700 dark:text-whatsapp-300'
                        : 'border-theme-border bg-theme-surface text-theme-secondary hover:bg-theme-subtle'
                    }`}
                  >
                    <span
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                        active
                          ? 'bg-gradient-to-br from-whatsapp-500 to-emerald-600 text-white'
                          : 'bg-theme-subtle text-theme-muted ring-1 ring-theme-border'
                      }`}
                    >
                      <Icon className="h-4 w-4" strokeWidth={2.25} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="block truncate text-label">{tab.label}</span>
                        {tab.badge && (
                          <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-micro uppercase text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                            {tab.badge}
                          </span>
                        )}
                      </span>
                      <span className="block truncate text-caption text-theme-muted">{tab.description}</span>
                    </span>
                    <ChevronDown
                      className={`h-4 w-4 shrink-0 text-theme-muted transition ${active ? 'rotate-180' : ''}`}
                    />
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <nav className="hidden lg:block lg:sticky lg:top-6 lg:self-start">
        <div className="dashboard-card overflow-hidden p-0">
          <div className="border-b border-theme-border bg-gradient-to-r from-emerald-500/[0.06] via-transparent to-violet-500/[0.04] px-4 py-3.5">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-whatsapp-500 to-emerald-600 text-white shadow-[0_4px_12px_rgba(37,211,102,0.25)]">
                <Settings2 className="h-3.5 w-3.5" strokeWidth={2.25} />
              </div>
              <div>
                <p className="text-label font-extrabold text-theme-fg">Settings</p>
                <p className="text-caption text-theme-muted">{tabs.length} areas</p>
              </div>
            </div>
          </div>

          <div className="space-y-3 p-2" role="tablist" aria-label="Settings sections">
            {grouped.map(({ group, items }) => (
              <div key={group}>
                <p className="mb-1 px-2 text-micro font-bold uppercase tracking-wider text-theme-muted">
                  {group}
                </p>
                <ul className="space-y-1">
                  {items.map((tab) => {
                    const Icon = tab.icon;
                    const active = activeTab === tab.id;
                    return (
                      <li key={tab.id}>
                        <button
                          type="button"
                          role="tab"
                          aria-selected={active}
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
                              <span className="block truncate text-label">{tab.label}</span>
                              {tab.badge && (
                                <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-micro uppercase text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                                  {tab.badge}
                                </span>
                              )}
                            </span>
                            <span className="block truncate text-caption text-theme-muted">
                              {tab.description}
                            </span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>

          <div className="border-t border-theme-border bg-theme-subtle/40 px-4 py-3">
            <div className="flex items-center gap-2">
              <span
                className={`h-2 w-2 rounded-full ${
                  isReady
                    ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]'
                    : 'bg-amber-400'
                }`}
              />
              <p className="text-caption font-semibold text-theme-secondary">
                {isReady ? 'Everything working' : 'Needs attention'}
              </p>
            </div>
          </div>
        </div>
      </nav>
    </>
  );
}
