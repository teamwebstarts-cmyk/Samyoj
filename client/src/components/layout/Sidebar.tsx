import { NavLink } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import { ChevronsLeft, X } from 'lucide-react';
import { getVisibleNavSections } from '../../config/navigation';
import { useAuth } from '../../contexts/AuthContext';
import { PlatformBrand } from './PlatformBrand';
import WhatsAppStatusCard from './WhatsAppStatusCard';
import { SidebarFlyoutTip, tipProps, useSidebarFlyoutTip } from './SidebarFlyoutTip';

interface SidebarProps {
  collapsed?: boolean;
  collapsible?: boolean;
  onToggleCollapse?: () => void;
  onNavigate?: () => void;
  onClose?: () => void;
  showClose?: boolean;
  inboxUnread?: number;
}

/** Abbreviated section titles keep header height when collapsed so icons never jump up. */
const SECTION_SHORT: Record<string, string> = {
  Main: 'MA',
  Support: 'SUPP',
  Insights: 'INS',
  Account: 'ACC',
};

function formatBadge(count: number): string {
  if (count <= 0) return '';
  return count > 99 ? '99+' : String(count);
}

function NavItem({
  to,
  icon: Icon,
  label,
  end,
  collapsed,
  onNavigate,
  badge,
  onShowTip,
  onHideTip,
}: {
  to: string;
  icon: LucideIcon;
  label: string;
  end?: boolean;
  collapsed?: boolean;
  onNavigate?: () => void;
  badge?: number;
  onShowTip: (text: string, el: HTMLElement) => void;
  onHideTip: () => void;
}) {
  const badgeLabel = formatBadge(badge ?? 0);
  const tipText = badgeLabel ? `${label} · ${badgeLabel}` : label;
  const flyout = tipProps(!!collapsed, tipText, onShowTip, onHideTip);

  return (
    <NavLink
      to={to}
      end={end}
      onClick={() => {
        onHideTip();
        onNavigate?.();
      }}
      aria-label={badgeLabel ? `${label}, ${badgeLabel} unread` : label}
      {...flyout}
      className={({ isActive }) =>
        [
          'sidebar-nav-item group relative box-border flex h-[var(--density-nav-item-h)] w-full items-center rounded-xl border pl-2.5 pr-2.5 text-[13.5px] font-medium',
          'transition-[background-color,color,box-shadow,border-color] duration-200 ease-out',
          isActive ? 'sidebar-nav-item--active' : 'sidebar-nav-item--idle',
        ].join(' ')
      }
    >
      {({ isActive }) => (
        <>
          <span
            className={[
              'sidebar-nav-icon relative z-[1] flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
              !isActive ? 'group-hover:scale-[1.04]' : '',
            ].join(' ')}
            style={{ transition: 'transform 200ms ease, background-color 200ms ease' }}
          >
            <Icon
              className={isActive ? 'h-[16px] w-[16px] text-white' : 'h-[17px] w-[17px]'}
              strokeWidth={isActive ? 2 : 1.75}
            />
            {badgeLabel ? (
              <span
                className={[
                  'sidebar-nav-badge absolute -right-0.5 -top-0.5 z-[2] inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-bold tabular-nums',
                  'transition-opacity duration-200 ease-out',
                  collapsed ? 'opacity-100' : 'pointer-events-none opacity-0',
                ].join(' ')}
                aria-hidden={!collapsed}
              >
                {badgeLabel}
              </span>
            ) : null}
          </span>

          <span
            className={[
              'sidebar-label ml-2.5 flex min-w-0 flex-1 items-center gap-2 overflow-hidden whitespace-nowrap',
              'transition-[opacity,margin] duration-200 ease-out',
              collapsed ? 'pointer-events-none ml-0 w-0 opacity-0' : 'opacity-100',
            ].join(' ')}
            aria-hidden={collapsed}
          >
            <span className="min-w-0 flex-1 truncate transition-[font-weight] duration-200 group-hover:font-semibold">
              {label}
            </span>
            {badgeLabel ? (
              <span className="sidebar-nav-badge inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full px-1.5 text-[10.5px] font-semibold tabular-nums">
                {badgeLabel}
              </span>
            ) : null}
          </span>
        </>
      )}
    </NavLink>
  );
}

function CollapseButton({
  collapsed,
  onToggle,
  onShowTip,
  onHideTip,
}: {
  collapsed: boolean;
  onToggle: () => void;
  onShowTip: (text: string, el: HTMLElement) => void;
  onHideTip: () => void;
}) {
  const label = collapsed ? 'Expand sidebar' : 'Collapse sidebar';
  const flyout = tipProps(true, label, onShowTip, onHideTip);

  return (
    <button
      type="button"
      onClick={() => {
        onHideTip();
        onToggle();
      }}
      aria-label={label}
      aria-expanded={!collapsed}
      {...flyout}
      className={[
        'sidebar-collapse-btn flex shrink-0 items-center justify-center rounded-full',
        collapsed ? 'h-7 w-7' : 'h-8 w-8',
      ].join(' ')}
    >
      <ChevronsLeft
        className={`transition-transform duration-[250ms] ease-out ${
          collapsed ? 'h-3.5 w-3.5 rotate-180' : 'h-4 w-4 rotate-0'
        }`}
        strokeWidth={1.8}
      />
    </button>
  );
}

function SectionTitle({ label, collapsed }: { label: string; collapsed: boolean }) {
  const short = SECTION_SHORT[label] ?? label.slice(0, 3).toUpperCase();

  return (
    <p
      className={[
        'relative mb-1.5 flex h-4 shrink-0 items-center overflow-hidden whitespace-nowrap',
        'text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500 px-2.5',
        collapsed ? 'invisible tracking-[0.08em]' : 'tracking-[0.14em]',
      ].join(' ')}
      aria-hidden={collapsed}
    >
      <span
        className={[
          'transition-opacity duration-200 ease-out',
          collapsed ? 'pointer-events-none absolute opacity-0' : 'opacity-100',
        ].join(' ')}
        aria-hidden={collapsed}
      >
        {label}
      </span>
      <span
        className={[
          'transition-opacity duration-200 ease-out',
          collapsed ? 'opacity-100' : 'pointer-events-none absolute opacity-0',
        ].join(' ')}
        aria-hidden={!collapsed}
      >
        {short}
      </span>
    </p>
  );
}

export default function Sidebar({
  collapsed = false,
  collapsible = false,
  onToggleCollapse,
  onNavigate,
  onClose,
  showClose,
  inboxUnread = 0,
}: SidebarProps) {
  const { orgRole, organization } = useAuth();
  const uiToggles = (organization?.settings as Record<string, unknown>)?.uiToggles as
    | { hiddenModules?: string[] }
    | undefined;
  const navSections = getVisibleNavSections(orgRole, uiToggles?.hiddenModules);
  // Tip enabled whenever collapsed (nav labels) or always for collapse button
  const { tip, onShowTip, onHideTip } = useSidebarFlyoutTip(true);

  return (
    <div
      className={[
        'sidebar-rail flex h-full min-h-0 flex-col',
        collapsed ? 'sidebar-rail--collapsed' : 'sidebar-rail--expanded',
      ].join(' ')}
    >
      <div
        className={[
          'relative z-[2] flex shrink-0 items-center border-b border-emerald-100/60',
          collapsed ? 'h-14 justify-center px-1.5' : 'h-14 pl-3 pr-2.5',
        ].join(' ')}
      >
        {collapsed ? (
          <div className="group/logo relative flex w-full items-center justify-center">
            <PlatformBrand collapsed size="sm" />

            {collapsible && onToggleCollapse && (
              <div
                className={[
                  'absolute inset-0 flex items-center justify-center',
                  'rounded-xl bg-white/85 opacity-0 shadow-sm backdrop-blur-[2px]',
                  'pointer-events-none transition-all duration-200 ease-out',
                  'group-hover/logo:pointer-events-auto group-hover/logo:opacity-100',
                  'group-focus-within/logo:pointer-events-auto group-focus-within/logo:opacity-100',
                  'dark:bg-neutral-900/90',
                ].join(' ')}
              >
                <CollapseButton
                  collapsed={collapsed}
                  onToggle={onToggleCollapse}
                  onShowTip={onShowTip}
                  onHideTip={onHideTip}
                />
              </div>
            )}
          </div>
        ) : (
          <>
            <PlatformBrand collapsed={false} size="md" />

            {showClose && onClose && (
              <button
                type="button"
                onClick={onClose}
                className="sidebar-collapse-btn ml-auto flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
                aria-label="Close menu"
              >
                <X className="h-4 w-4" strokeWidth={1.8} />
              </button>
            )}

            {collapsible && onToggleCollapse && (
              <div className="ml-auto shrink-0">
                <CollapseButton
                  collapsed={collapsed}
                  onToggle={onToggleCollapse}
                  onShowTip={onShowTip}
                  onHideTip={onHideTip}
                />
              </div>
            )}
          </>
        )}
      </div>

      <nav
        className="sidebar-scroll relative z-[2] min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-2 py-2.5"
        aria-label="Primary"
      >
        <div className="flex flex-col gap-3.5">
          {navSections.map(({ label, items }) => (
            <div key={label}>
              <SectionTitle label={label} collapsed={collapsed} />
              <div className="flex flex-col gap-1">
                {items.map((item) => (
                  <NavItem
                    key={item.to}
                    {...item}
                    collapsed={collapsed}
                    onNavigate={onNavigate}
                    badge={item.to === '/inbox' ? inboxUnread : undefined}
                    onShowTip={onShowTip}
                    onHideTip={onHideTip}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </nav>

      <div className="relative z-[2] shrink-0 border-t border-emerald-100/60 p-2">
        <WhatsAppStatusCard collapsed={collapsed} onNavigate={onNavigate} />
      </div>

      <SidebarFlyoutTip tip={tip} />
    </div>
  );
}
