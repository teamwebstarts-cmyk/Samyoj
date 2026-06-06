import { NavLink } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import {
  BarChart3,
  Bot,
  FileText,
  Headset,
  LogOut,
  MessageSquare,
  PanelLeftClose,
  PanelLeftOpen,
  PhoneCall,
  Send,
  Settings,
  Users,
  X,
  Zap,
} from 'lucide-react';
import { PlatformBrand } from './PlatformBrand';

const navSections = [
  {
    label: 'Main',
    items: [
      { to: '/', icon: BarChart3, label: 'Dashboard', end: true },
      { to: '/inbox', icon: MessageSquare, label: 'Inbox' },
      { to: '/calls', icon: PhoneCall, label: 'Calls' },
    ],
  },
  {
    label: 'Grow',
    items: [
      { to: '/automations', icon: Zap, label: 'Automations' },
      { to: '/ai-bot', icon: Bot, label: 'AI Bots' },
      { to: '/campaigns', icon: Send, label: 'Campaigns' },
      { to: '/templates', icon: FileText, label: 'Templates' },
      { to: '/contacts', icon: Users, label: 'Contacts' },
    ],
  },
  {
    label: 'Account',
    items: [
      { to: '/team', icon: Headset, label: 'Team' },
      { to: '/settings', icon: Settings, label: 'Settings' },
    ],
  },
];

interface SidebarProps {
  collapsed?: boolean;
  collapsible?: boolean;
  onToggleCollapse?: () => void;
  onNavigate?: () => void;
  onLogout: () => void;
  onClose?: () => void;
  showClose?: boolean;
}

function NavItem({
  to,
  icon: Icon,
  label,
  end,
  collapsed,
  onNavigate,
}: {
  to: string;
  icon: LucideIcon;
  label: string;
  end?: boolean;
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  return (
    <NavLink
      to={to}
      end={end}
      onClick={onNavigate}
      title={collapsed ? label : undefined}
      className={({ isActive }) =>
        `group relative flex items-center rounded-lg font-medium transition-colors ${
          collapsed ? 'h-10 w-10 justify-center' : 'h-10 gap-3 px-3 text-[14px]'
        } ${
          isActive
            ? collapsed
              ? 'bg-whatsapp-500 text-white shadow-[0_2px_8px_rgba(37,211,102,0.35)]'
              : 'border-l-[3px] border-whatsapp-500 bg-emerald-50 pl-[9px] text-whatsapp-900'
            : collapsed
              ? 'text-neutral-800 hover:bg-neutral-100'
              : 'border-l-[3px] border-transparent text-neutral-800 hover:bg-neutral-100'
        }`
      }
    >
      {({ isActive }) => (
        <>
          <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={isActive ? 2.25 : 2} />
          {!collapsed && <span className="truncate">{label}</span>}
        </>
      )}
    </NavLink>
  );
}

export default function Sidebar({
  collapsed = false,
  collapsible = false,
  onToggleCollapse,
  onNavigate,
  onLogout,
  onClose,
  showClose,
}: SidebarProps) {
  return (
    <div className="flex h-full flex-col bg-white">
      {/* Header: brand + collapse/close */}
      <div className={`shrink-0 border-b border-neutral-200 ${collapsed ? 'px-2 py-3' : 'px-3 py-3'}`}>
        {collapsed ? (
          <div className="flex flex-col items-center gap-2">
            {collapsible && onToggleCollapse && (
              <button
                type="button"
                onClick={onToggleCollapse}
                title="Expand sidebar"
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-200 text-neutral-700 transition hover:bg-neutral-100"
              >
                <PanelLeftOpen className="h-[18px] w-[18px]" />
              </button>
            )}
            <PlatformBrand collapsed />
          </div>
        ) : (
          <div className="flex items-center justify-between gap-2">
            <PlatformBrand />
            <div className="flex items-center gap-1">
              {collapsible && onToggleCollapse && (
                <button
                  type="button"
                  onClick={onToggleCollapse}
                  title="Collapse sidebar"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-neutral-200 text-neutral-700 transition hover:bg-neutral-100"
                >
                  <PanelLeftClose className="h-[18px] w-[18px]" />
                </button>
              )}
              {showClose && onClose && (
                <button
                  type="button"
                  onClick={onClose}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-neutral-200 text-neutral-700 transition hover:bg-neutral-100"
                  aria-label="Close menu"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className={`flex-1 overflow-y-auto ${collapsed ? 'px-2 py-3' : 'px-3 py-4'}`}>
        {collapsed ? (
          <div className="flex flex-col items-center gap-1">
            {navSections.flatMap(({ items }) =>
              items.map((item) => (
                <NavItem key={item.to} {...item} collapsed onNavigate={onNavigate} />
              )),
            )}
          </div>
        ) : (
          <div className="space-y-5">
            {navSections.map(({ label, items }) => (
              <div key={label}>
                <p className="mb-2 px-3 text-[11px] font-bold uppercase tracking-wider text-neutral-500">
                  {label}
                </p>
                <div className="space-y-0.5">
                  {items.map((item) => (
                    <NavItem key={item.to} {...item} onNavigate={onNavigate} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </nav>

      {/* Footer: logout */}
      <div className={`shrink-0 border-t border-neutral-200 ${collapsed ? 'p-2' : 'p-3'}`}>
        <button
          type="button"
          onClick={onLogout}
          title={collapsed ? 'Log out' : undefined}
          className={`inline-flex h-10 items-center justify-center rounded-lg border border-neutral-200 bg-white text-[13px] font-semibold text-neutral-800 transition hover:border-red-200 hover:bg-red-50 hover:text-red-700 ${
            collapsed ? 'mx-auto w-10' : 'w-full gap-2'
          }`}
        >
          <LogOut className="h-[18px] w-[18px] shrink-0" />
          {!collapsed && <span>Log out</span>}
        </button>
      </div>
    </div>
  );
}
