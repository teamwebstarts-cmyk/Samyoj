import {
  BookOpen,
  Building2,
  CreditCard,
  LayoutDashboard,
  LogOut,
  Mail,
  PanelLeftClose,
  PanelLeftOpen,
  ScrollText,
  ShieldCheck,
  TriangleAlert,
  Users,
} from 'lucide-react';
import { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useOperator } from '../context/OperatorContext';
import { visibleNavGroups } from '../lib/routes';
import { PlatformBrand } from './PlatformBrand';

const ICONS: Record<string, typeof LayoutDashboard> = {
  '/': LayoutDashboard,
  '/accounts': Building2,
  '/billing': CreditCard,
  '/library': BookOpen,
  '/errors': TriangleAlert,
  '/outreach': Mail,
  '/operators': Users,
  '/audit': ScrollText,
};

const PATH_TITLES: Record<string, string> = {
  '/': 'Overview',
  '/accounts': 'Organizations',
  '/billing': 'Billing Studio',
  '/library': 'Template library',
  '/errors': 'Meta Telemetry',
  '/outreach': 'Email Outreach',
  '/operators': 'Staff & Access',
  '/audit': 'Compliance Audit',
};

function NavGroup({
  label,
  items,
}: {
  label: string;
  items: Array<{ to: string; label: string }>;
}) {
  if (items.length === 0) return null;
  return (
    <div className="flex gap-1 md:flex-col md:gap-1">
      <p className="rail-group-label hidden px-2.5 pb-1 pt-2 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400 md:block">
        {label}
      </p>
      {items.map((item) => {
        const Icon = ICONS[item.to] ?? LayoutDashboard;
        return (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className="rail-nav-item group"
            title={item.label}
          >
            {({ isActive }) => (
              <>
                <span className="rail-nav-icon">
                  <Icon className="h-4 w-4" strokeWidth={isActive ? 2.2 : 1.8} />
                </span>
                <span className="truncate">{item.label}</span>
              </>
            )}
          </NavLink>
        );
      })}
    </div>
  );
}

export function Shell() {
  const { operator, logout } = useOperator();
  const location = useLocation();
  if (!operator) return null;

  const { work, staff } = visibleNavGroups(operator.role);
  const currentPath = location.pathname.startsWith('/accounts/') ? '/accounts' : location.pathname;
  const currentTitle = PATH_TITLES[currentPath] || 'Console';
  /** Icon-only rail (desktop). Mobile bottom bar is untouched. */
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div
      className={`min-h-screen md:grid ${collapsed ? 'md:grid-cols-[4.25rem_minmax(0,1fr)]' : 'md:grid-cols-[14.5rem_minmax(0,1fr)]'}`}
      style={{ '--rail-width': collapsed ? '4.25rem' : '14.5rem' } as React.CSSProperties}
    >
      <a href="#main" className="skip-to-content">
        Skip to content
      </a>

      {/* Sidebar Rail */}
      <aside className={`flex items-center gap-2 border-b border-slate-200 bg-white/95 px-3 py-3 text-slate-900 md:sticky md:top-0 md:h-screen md:flex-col md:items-stretch md:border-b-0 md:border-r md:border-slate-200 md:px-3 md:py-4 shadow-sm z-20 ${collapsed ? 'rail-collapsed' : ''}`}>
        <div className="hidden min-w-0 px-1 md:block">
          <div className="flex min-w-0 items-center justify-between gap-1.5">
            <PlatformBrand size="sm" collapsed={collapsed} />
            {/* Collapse toggler — right of the brand; beside the mark when collapsed */}
            <button
              type="button"
              onClick={() => setCollapsed((value) => !value)}
              aria-pressed={collapsed}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              className="rail-collapse-toggle"
            >
              {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
            </button>
          </div>
          {!collapsed && (
            <div className="mt-2.5 flex items-center justify-between gap-1.5 rounded-lg bg-indigo-50 border border-indigo-200/60 px-2 py-1 text-[10px] text-indigo-700">
              <span className="flex items-center gap-1.5 font-medium">
                <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 animate-pulse" />
                Samyoj Ops
              </span>
              <span className="font-mono text-[9px] text-indigo-400">v2.4</span>
            </div>
          )}
        </div>

        <nav className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto md:mt-6 md:flex-col md:gap-3 md:overflow-y-auto">
          <NavGroup label="Work" items={work} />
          <NavGroup label="Staff & Security" items={staff} />
        </nav>

        {/* Operator Profile Card */}
        {collapsed ? (
          <div className="hidden md:flex flex-col items-center gap-2 border-t border-slate-200 pt-3 mt-auto">
            <span
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200/70"
              title={`${operator.email} · ${operator.role}`}
            >
              <ShieldCheck className="h-4 w-4" />
            </span>
            <button
              type="button"
              onClick={() => void logout()}
              aria-label="Sign out"
              title="Sign out"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-white border border-indigo-200/70 text-indigo-700 hover:bg-indigo-50 hover:text-indigo-800 transition-colors"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <div className="hidden md:block pt-3 border-t border-slate-200 mt-auto">
          <div className="rounded-xl bg-indigo-50/70 border border-indigo-200/70 p-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold text-indigo-950">{operator.email}</p>
                <div className="mt-1 flex items-center gap-1.5">
                  <span className="inline-flex items-center rounded-full bg-white px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-indigo-700 border border-indigo-200">
                    {operator.role}
                  </span>
                  {operator.mfaEnabled && (
                    <span className="inline-flex items-center text-indigo-500" title="MFA Protected">
                      <ShieldCheck className="h-3 w-3" />
                    </span>
                  )}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => void logout()}
              className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-lg bg-white border border-indigo-200/70 py-1.5 text-center text-xs font-medium text-indigo-700 hover:bg-indigo-50 hover:text-indigo-800 transition-colors"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign out
            </button>
          </div>
        </div>
        )}
      </aside>

      {/* Main Content Area */}
      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/85 backdrop-blur-md px-4 py-2.5 md:px-8">
          <div className="content-shell flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Platform</span>
                  <span className="text-slate-300">/</span>
                  <span className="text-xs font-semibold text-slate-700">{currentTitle}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <div className="hidden sm:flex items-center gap-2 text-xs text-slate-500">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 border border-indigo-200/60 px-2.5 py-0.5 font-medium text-indigo-800">
                  <span className="h-1.5 w-1.5 rounded-full bg-success-500 animate-pulse" />
                  Live Platform
                </span>
              </div>
              <div className="md:hidden">
                <button
                  type="button"
                  onClick={() => void logout()}
                  className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Sign out
                </button>
              </div>
            </div>
          </div>
        </header>

        <main id="main" className="flex-1 px-4 py-6 md:px-8 md:py-8">
          <div className="content-shell">
            <Outlet />
          </div>
        </main>

        <footer className="border-t border-slate-200/60 bg-white/40 px-4 py-4 text-[11px] leading-relaxed text-slate-400 md:px-8">
          <div className="content-shell flex flex-col sm:flex-row items-center justify-between gap-2">
            <p>
              Samyoj Platform Operator Console · Account Telemetry & Health Monitoring
            </p>
            <p className="text-slate-400/80">
              Customer chat data, phone numbers & Meta tokens are strictly isolated.
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
}
