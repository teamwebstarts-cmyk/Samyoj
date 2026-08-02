import { NavLink } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import { ChevronsLeft, X } from 'lucide-react';
import { getVisibleNavSections } from '../../config/navigation';
import { useAuth } from '../../contexts/AuthContext';
import { PlatformBrand } from './PlatformBrand';
import WhatsAppStatusCard from './WhatsAppStatusCard';

interface SidebarProps {
  collapsed?: boolean;
  collapsible?: boolean;
  onToggleCollapse?: () => void;
  onNavigate?: () => void;
  onClose?: () => void;
  showClose?: boolean;
  inboxUnread?: number;
}

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
}: {
  to: string;
  icon: LucideIcon;
  label: string;
  end?: boolean;
  collapsed?: boolean;
  onNavigate?: () => void;
  badge?: number;
}) {
  const badgeLabel = formatBadge(badge ?? 0);

  return (
    <NavLink
      to={to}
      end={end}
      onClick={onNavigate}
      title={collapsed ? (badgeLabel ? `${label} (${badgeLabel})` : label) : undefined}
      aria-label={badgeLabel ? `${label}, ${badgeLabel} unread` : label}
      className={({ isActive }) =>
        [
          'sidebar-nav-item group relative box-border flex items-center border transition-[background-color,color,box-shadow,border-color,transform,font-weight] duration-[180ms] ease-out',
          collapsed
            ? 'h-12 w-12 justify-center rounded-2xl'
            : 'h-12 w-full gap-3.5 rounded-2xl px-4 text-[15px] font-medium',
          isActive ? 'sidebar-nav-item--active' : 'sidebar-nav-item--idle',
        ].join(' ')
      }
    >
      {({ isActive }) => (
        <>
          <span
            className={[
              'sidebar-nav-icon flex shrink-0 items-center justify-center transition-transform duration-[180ms] ease-out',
              isActive ? 'h-[34px] w-[34px] rounded-[10px]' : 'h-5 w-5',
              !collapsed && !isActive ? 'group-hover:translate-x-0.5 group-hover:scale-105' : '',
              collapsed && !isActive ? 'group-hover:scale-105' : '',
            ].join(' ')}
          >
            <Icon
              className={isActive ? 'h-[18px] w-[18px] text-white' : 'h-5 w-5'}
              strokeWidth={1.8}
            />
          </span>
          {!collapsed && (
            <>
              <span className="min-w-0 flex-1 truncate transition-[font-weight] duration-[180ms] group-hover:font-semibold">
                {label}
              </span>
              {badgeLabel ? (
                <span className="sidebar-nav-badge inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold tabular-nums">
                  {badgeLabel}
                </span>
              ) : null}
            </>
          )}
          {collapsed && badgeLabel ? (
            <span className="sidebar-nav-badge absolute -right-0.5 -top-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-bold tabular-nums">
              {badgeLabel}
            </span>
          ) : null}
        </>
      )}
    </NavLink>
  );
}

function CollapseButton({
  collapsed,
  onToggle,
}: {
  collapsed: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      aria-expanded={!collapsed}
      className="sidebar-collapse-btn flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
    >
      <ChevronsLeft
        className={`h-4 w-4 transition-transform duration-[250ms] ease-out ${
          collapsed ? 'rotate-180' : 'rotate-0'
        }`}
        strokeWidth={1.8}
      />
    </button>
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
  const { orgRole } = useAuth();
  const navSections = getVisibleNavSections(orgRole);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div
        className={`flex shrink-0 items-center border-b border-theme-border/70 ${
          collapsed ? 'flex-col justify-center gap-2.5 px-2 py-3.5' : 'h-16 justify-between gap-2 px-5'
        }`}
      >
        {collapsed ? (
          <>
            <PlatformBrand collapsed size="sm" />
            {collapsible && onToggleCollapse && (
              <CollapseButton collapsed onToggle={onToggleCollapse} />
            )}
          </>
        ) : (
          <>
            <PlatformBrand />
            <div className="flex items-center gap-1.5">
              {collapsible && onToggleCollapse && (
                <CollapseButton collapsed={false} onToggle={onToggleCollapse} />
              )}
              {showClose && onClose && (
                <button
                  type="button"
                  onClick={onClose}
                  className="sidebar-collapse-btn flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
                  aria-label="Close menu"
                >
                  <X className="h-4 w-4" strokeWidth={1.8} />
                </button>
              )}
            </div>
          </>
        )}
      </div>

      <nav
        className={`min-h-0 flex-1 overflow-y-auto overflow-x-hidden ${
          collapsed ? 'px-2 py-3' : 'px-4 py-4'
        }`}
        aria-label="Primary"
      >
        {collapsed ? (
          <div className="flex flex-col items-center gap-3">
            {navSections.flatMap(({ items }) =>
              items.map((item) => (
                <NavItem
                  key={item.to}
                  {...item}
                  collapsed
                  onNavigate={onNavigate}
                  badge={item.to === '/inbox' ? inboxUnread : undefined}
                />
              )),
            )}
          </div>
        ) : (
          <div className="space-y-6">
            {navSections.map(({ label, items }) => (
              <div key={label}>
                <p className="mb-2.5 px-4 text-[11px] font-bold uppercase tracking-[0.15em] text-slate-400 dark:text-slate-500">
                  {label}
                </p>
                <div className="flex flex-col gap-3">
                  {items.map((item) => (
                    <NavItem
                      key={item.to}
                      {...item}
                      onNavigate={onNavigate}
                      badge={item.to === '/inbox' ? inboxUnread : undefined}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </nav>

      <div className={`shrink-0 border-t border-theme-border/70 ${collapsed ? 'p-2.5' : 'p-5'}`}>
        <WhatsAppStatusCard collapsed={collapsed} onNavigate={onNavigate} />
      </div>
    </div>
  );
}
