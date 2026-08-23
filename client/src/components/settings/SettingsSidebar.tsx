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

function SettingsNavButton({
  tab,
  active,
  onClick,
}: {
  tab: SettingsNavItem;
  active: boolean;
  onClick: () => void;
}) {
  const Icon = tab.icon;

  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      aria-current={active ? 'page' : undefined}
      onClick={onClick}
      className={`flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2.5 text-left transition sm:rounded-xl sm:py-2 ${
        active
          ? 'bg-whatsapp-500/10 ring-1 ring-whatsapp-500/25'
          : 'hover:bg-whatsapp-500/5'
      }`}
    >
      <span
        className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition sm:h-7 sm:w-7 ${
          active
            ? 'bg-gradient-to-br from-whatsapp-500 to-emerald-600 text-white'
            : 'bg-theme-subtle text-theme-muted ring-1 ring-theme-border'
        }`}
      >
        <Icon className="h-4 w-4 sm:h-3.5 sm:w-3.5" strokeWidth={2.25} />
      </span>
      <span className="min-w-0 flex-1 pt-0.5">
        <span
          className={`block text-[13px] font-semibold leading-tight sm:text-[12px] sm:leading-none ${
            active ? 'text-whatsapp-800 dark:text-whatsapp-300' : 'text-theme-fg'
          }`}
        >
          {tab.label}
        </span>
        {tab.hint ? (
          <span className="mt-0.5 block text-[11px] font-medium leading-snug text-theme-muted sm:mt-1 sm:text-[9px] sm:leading-[1.3]">
            {tab.hint}
          </span>
        ) : null}
      </span>
    </button>
  );
}

export default function SettingsSidebar({ tabs, activeTab, onTabChange }: SettingsSidebarProps) {
  return (
    <>
      {/* Mobile — vertical list, no horizontal scroll */}
      <nav className="lg:hidden" aria-label="Settings sections">
        <div
          className="rounded-xl border border-theme-border bg-theme-surface p-2 shadow-sm"
          role="tablist"
        >
          <ul className="space-y-1">
            {tabs.map((tab) => (
              <li key={tab.id}>
                <SettingsNavButton
                  tab={tab}
                  active={activeTab === tab.id}
                  onClick={() => onTabChange(tab.id)}
                />
              </li>
            ))}
          </ul>
        </div>
      </nav>

      {/* Desktop — left rail */}
      <nav className="hidden w-[16rem] shrink-0 lg:block" aria-label="Settings sections">
        <div
          className="sticky top-6 rounded-xl border border-whatsapp-500/10 bg-theme-surface/80 p-3 shadow-none backdrop-blur-sm"
          role="tablist"
        >
          <ul className="space-y-2">
            {tabs.map((tab) => (
              <li key={tab.id}>
                <SettingsNavButton
                  tab={tab}
                  active={activeTab === tab.id}
                  onClick={() => onTabChange(tab.id)}
                />
              </li>
            ))}
          </ul>
        </div>
      </nav>
    </>
  );
}
