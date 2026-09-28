import { useEffect, useState } from 'react';
import { NavLink, useLocation, useSearchParams } from 'react-router-dom';
import { resolveSidebarAccent, type SidebarChannelAccent } from '../../utils/sidebarChannelAccent';
import type { LucideIcon } from 'lucide-react';
import { ChevronsLeft, ChevronDown, X } from 'lucide-react';
import { getVisibleNavSections, type NavSection } from '../../config/navigation';
import { useAuth } from '../../contexts/AuthContext';
import { PlatformBrand } from './PlatformBrand';
import WhatsAppGlyph from '../dashboard/icons/WhatsAppGlyph';
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
  Channels: 'CH',
  'AI Studio': 'AI',
  Contacts: 'CON',
  WhatsApp: 'WA',
  Facebook: 'FB',
  Instagram: 'IG',
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
  glyph,
  label,
  end,
  collapsed,
  onNavigate,
  badge,
  onShowTip,
  onHideTip,
  accent = 'neutral',
}: {
  to: string;
  icon: LucideIcon;
  glyph?: 'whatsapp';
  label: string;
  end?: boolean;
  collapsed?: boolean;
  onNavigate?: () => void;
  badge?: number;
  onShowTip: (text: string, el: HTMLElement) => void;
  onHideTip: () => void;
  accent?: SidebarChannelAccent;
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
          isActive
            ? `sidebar-nav-item--active sidebar-nav-item--accent-${accent}`
            : 'sidebar-nav-item--idle',
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
            {glyph === 'whatsapp' ? (
              <WhatsAppGlyph className={isActive ? 'h-4 w-4 text-white' : 'h-4 w-4'} />
            ) : (
              <Icon
                className={isActive ? 'h-[16px] w-[16px] text-white' : 'h-[17px] w-[17px]'}
                strokeWidth={isActive ? 2 : 1.75}
              />
            )}
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

function PlatformDropdown({
  section,
  collapsed,
  onNavigate,
  inboxUnread,
  onShowTip,
  onHideTip,
}: {
  section: NavSection;
  collapsed?: boolean;
  onNavigate?: () => void;
  inboxUnread: number;
  onShowTip: (text: string, el: HTMLElement) => void;
  onHideTip: () => void;
}) {
  const location = useLocation();
  const Icon = section.icon;
  const childActive = section.items.some(
    (item) => location.pathname === item.to || location.pathname.startsWith(`${item.to}/`)
  );
  const storageKey = `sidebar-dropdown:${section.label}`;
  const [open, setOpen] = useState(() => {
    try {
      const stored = sessionStorage.getItem(storageKey);
      if (stored === '1') return true;
      if (stored === '0') return false;
    } catch {
      /* ignore */
    }
    return true;
  });

  useEffect(() => {
    if (childActive) setOpen(true);
  }, [childActive]);

  const toggle = () => {
    setOpen((prev) => {
      const next = !prev;
      try {
        sessionStorage.setItem(storageKey, next ? '1' : '0');
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  if (!Icon) return null;

  if (collapsed) {
    return (
      <NavItem
        to={section.items[0]?.to || '/'}
        icon={Icon}
        glyph={section.accent === 'whatsapp' ? 'whatsapp' : undefined}
        label={section.label}
        collapsed
        onNavigate={onNavigate}
              badge={section.items.some((i) => i.to === '/inbox') ? inboxUnread : undefined}
        accent={section.accent}
        onShowTip={onShowTip}
        onHideTip={onHideTip}
      />
    );
  }

  // Only the visible leaf is --active. Parent fills only while children are hidden.
  const parentActive = childActive && !open;
  const accentIdle =
    section.accent === 'facebook'
      ? 'text-[#1877F2]'
      : section.accent === 'whatsapp'
        ? 'text-emerald-600'
        : section.accent === 'instagram'
          ? 'text-[#E4405F]'
          : '';

  const dropdownClass = [
    'sidebar-dropdown',
    `sidebar-dropdown--${section.accent || 'default'}`,
    parentActive ? 'sidebar-dropdown--parent-active' : '',
    childActive && open ? 'sidebar-dropdown--child-open' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={dropdownClass}>
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-current={parentActive ? 'page' : undefined}
        className={[
          'sidebar-nav-item group relative box-border flex h-[var(--density-nav-item-h)] w-full items-center rounded-xl border pl-2.5 pr-2.5 text-[13.5px] font-medium',
          'transition-[background-color,color,box-shadow,border-color] duration-200 ease-out',
          parentActive
            ? `sidebar-nav-item--active sidebar-nav-item--accent-${section.accent}`
            : 'sidebar-nav-item--idle',
        ].join(' ')}
      >
        <span className="sidebar-nav-icon relative z-[1] flex h-8 w-8 shrink-0 items-center justify-center rounded-lg">
          {section.accent === 'whatsapp' ? (
            <WhatsAppGlyph
              className={parentActive ? 'h-4 w-4 text-white' : 'h-4 w-4 text-emerald-600'}
            />
          ) : (
            <Icon
              className={parentActive ? 'h-[16px] w-[16px] text-white' : `h-[17px] w-[17px] ${accentIdle}`}
              strokeWidth={parentActive ? 2 : 1.75}
            />
          )}
        </span>
        <span className="ml-2.5 flex min-w-0 flex-1 items-center gap-2 overflow-hidden whitespace-nowrap">
          <span className="min-w-0 flex-1 truncate text-left">{section.label}</span>
          <ChevronDown
            className={`h-4 w-4 shrink-0 opacity-70 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
            strokeWidth={1.8}
          />
        </span>
      </button>
      {open ? (
        <div className="mt-1 flex flex-col gap-1 pl-3">
          {section.items.map((item) => (
            <NavItem
              key={item.to}
              {...item}
              collapsed={false}
              onNavigate={onNavigate}
              badge={item.to === '/inbox' ? inboxUnread : undefined}
              accent={section.accent}
              onShowTip={onShowTip}
              onHideTip={onHideTip}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function SectionTitle({
  label,
  collapsed,
  accent,
}: {
  label: string;
  collapsed: boolean;
  accent?: 'facebook' | 'whatsapp' | 'instagram' | 'studio';
}) {
  const short = SECTION_SHORT[label] ?? label.slice(0, 3).toUpperCase();
  const accentBar =
    accent === 'facebook'
      ? 'before:absolute before:left-0 before:top-0 before:h-full before:w-[3px] before:rounded-full before:bg-[#1877F2]'
        : accent === 'whatsapp'
          ? 'before:absolute before:left-0 before:top-0 before:h-full before:w-[3px] before:rounded-full before:bg-emerald-500'
          : accent === 'instagram'
            ? 'before:absolute before:left-0 before:top-0 before:h-full before:w-[3px] before:rounded-full before:bg-gradient-to-b before:from-[#f09433] before:via-[#dc2743] before:to-[#bc1888]'
            : accent === 'studio'
              ? 'before:absolute before:left-0 before:top-0 before:h-full before:w-[3px] before:rounded-full before:bg-gradient-to-b before:from-violet-400 before:to-violet-700'
              : '';

  return (
    <p
      className={[
        'relative mb-1.5 flex h-4 shrink-0 items-center overflow-hidden whitespace-nowrap',
        'text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500 px-2.5',
        collapsed ? 'invisible tracking-[0.08em]' : 'tracking-[0.14em]',
        accentBar,
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
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const channelAccent = resolveSidebarAccent(location.pathname, searchParams.toString());
  const headerBorderClass =
    channelAccent === 'facebook'
      ? 'border-blue-100/80'
      : channelAccent === 'instagram'
        ? 'border-pink-100/80'
        : channelAccent === 'studio'
          ? 'border-violet-100/80'
          : 'border-emerald-100/60';
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
          `relative z-[2] flex shrink-0 items-center border-b ${headerBorderClass}`,
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
          {navSections.map((section) => {
            if (section.platforms?.length) {
              return (
                <div key={section.label}>
                  <SectionTitle label={section.label} collapsed={collapsed} />
                  <div className="flex flex-col gap-1">
                    {section.platforms.map((platform) => (
                      <PlatformDropdown
                        key={platform.label}
                        section={platform}
                        collapsed={collapsed}
                        onNavigate={onNavigate}
                        inboxUnread={inboxUnread}
                        onShowTip={onShowTip}
                        onHideTip={onHideTip}
                      />
                    ))}
                  </div>
                </div>
              );
            }

            if (section.dropdown) {
              return (
                <PlatformDropdown
                  key={section.label}
                  section={section}
                  collapsed={collapsed}
                  onNavigate={onNavigate}
                  inboxUnread={inboxUnread}
                  onShowTip={onShowTip}
                  onHideTip={onHideTip}
                />
              );
            }

            const sectionAccent: SidebarChannelAccent =
              section.label === 'AI Studio'
                ? 'studio'
                : section.label
                  ? 'neutral'
                  : channelAccent;
            const sectionClass =
              section.label === 'AI Studio' ? 'sidebar-section sidebar-section--studio' : 'sidebar-section';

            return (
              <div key={section.label || section.items[0]?.to || 'nav'} className={sectionClass}>
                {section.label ? (
                  <SectionTitle
                    label={section.label}
                    collapsed={collapsed}
                    accent={section.label === 'AI Studio' ? 'studio' : section.accent}
                  />
                ) : null}
                <div className="flex flex-col gap-1">
                  {section.items.map((item) => (
                    <NavItem
                      key={item.to}
                      {...item}
                      collapsed={collapsed}
                      onNavigate={onNavigate}
                      badge={item.to === '/inbox' ? inboxUnread : undefined}
                      accent={item.to === '/' ? channelAccent : sectionAccent}
                      onShowTip={onShowTip}
                      onHideTip={onHideTip}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </nav>

      <SidebarFlyoutTip tip={tip} />
    </div>
  );
}
