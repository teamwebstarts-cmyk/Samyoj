import type { LucideIcon } from 'lucide-react';

export interface SettingsNavItem {
  id: string;
  label: string;
  icon: LucideIcon;
  group?: string;
}

interface SettingsSidebarProps {
  tabs: SettingsNavItem[];
  activeTab: string;
  onTabChange: (id: string) => void;
}

function groupTabs(tabs: SettingsNavItem[]): Array<{ group: string; items: SettingsNavItem[] }> {
  const groups: Array<{ group: string; items: SettingsNavItem[] }> = [];
  for (const tab of tabs) {
    const groupName = tab.group || 'General';
    const existing = groups.find((g) => g.group === groupName);
    if (existing) existing.items.push(tab);
    else groups.push({ group: groupName, items: [tab] });
  }
  return groups;
}

export default function SettingsSidebar({ tabs, activeTab, onTabChange }: SettingsSidebarProps) {
  const grouped = groupTabs(tabs);

  return (
    <>
      {/* Compact pill scroller for narrow screens */}
      <nav
        className="flex gap-1.5 overflow-x-auto pb-1 lg:hidden"
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
                  ? 'bg-gradient-to-br from-whatsapp-500 to-emerald-600 text-white shadow-[0_4px_12px_rgba(37,211,102,0.25)]'
                  : 'bg-theme-subtle text-theme-secondary ring-1 ring-theme-border hover:bg-theme-surface hover:text-theme-fg'
              }`}
            >
              <Icon className="h-3.5 w-3.5" strokeWidth={2.25} />
              {tab.label}
            </button>
          );
        })}
      </nav>

      {/* Left rail for desktop */}
      <nav className="hidden w-56 shrink-0 lg:block" aria-label="Settings sections">
        <div className="sticky top-6 space-y-4" role="tablist">
          {grouped.map(({ group, items }) => (
            <div key={group}>
              <p className="mb-1.5 px-3 text-[10px] font-extrabold uppercase tracking-[0.08em] text-theme-muted">
                {group}
              </p>
              <ul className="space-y-0.5">
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
                        title={tab.label}
                        className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-[13px] font-semibold transition ${
                          active
                            ? 'bg-whatsapp-500/10 text-whatsapp-700 ring-1 ring-whatsapp-500/25 dark:text-whatsapp-300'
                            : 'text-theme-secondary hover:bg-theme-subtle hover:text-theme-fg'
                        }`}
                      >
                        <span
                          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition ${
                            active
                              ? 'bg-gradient-to-br from-whatsapp-500 to-emerald-600 text-white shadow-[0_4px_12px_rgba(37,211,102,0.25)]'
                              : 'bg-theme-subtle text-theme-muted ring-1 ring-theme-border'
                          }`}
                        >
                          <Icon className="h-4 w-4" strokeWidth={2.25} />
                        </span>
                        <span className="truncate">{tab.label}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </nav>
    </>
  );
}
