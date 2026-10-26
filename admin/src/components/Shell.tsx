import {
  BookOpen,
  Building2,
  ChevronsLeft,
  CreditCard,
  LayoutDashboard,
  LogOut,
  Mail,
  MoreVertical,
  ScrollText,
  TriangleAlert,
  Users,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useOperator } from '../context/OperatorContext';
import { visibleNavGroups } from '../lib/routes';
import { PlatformBrand } from './PlatformBrand';
import { Topbar } from './Topbar';

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

function NavGroup({
  label,
  items,
  overflowFrom,
}: {
  label: string;
  items: Array<{ to: string; label: string }>;
  /** Hide items at this index and beyond on mobile (More-sheet territory). */
  overflowFrom?: number;
}) {
  if (items.length === 0) return null;
  return (
    // `contents` on mobile: tiles become direct flex children of the bar's nav,
    // so `flex: 1 1 0` actually equalizes them (a wrapping div would break it).
    <div className="contents md:flex md:flex-col md:gap-1">
      <p className="rail-group-label hidden px-2.5 pb-1 pt-2 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400 md:block">
        {label}
      </p>
      {items.map((item, index) => {
        const Icon = ICONS[item.to] ?? LayoutDashboard;
        const mobileHidden = overflowFrom !== undefined && index >= overflowFrom;
        return (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={`rail-nav-item group ${mobileHidden ? 'max-md:hidden' : ''}`}
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
  /** Icon-only rail (desktop). Mobile bottom bar is untouched. Persisted like the client sidebar. */
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem('samyoj-admin-sidebar-collapsed') === 'true';
    } catch {
      return false;
    }
  });
  const toggleCollapsed = () => {
    setCollapsed((value) => {
      try {
        localStorage.setItem('samyoj-admin-sidebar-collapsed', String(!value));
      } catch {
        // ignore storage errors
      }
      return !value;
    });
  };
  /** Mobile-only sheet holding the navs packed out of the bottom bar. */
  const [moreOpen, setMoreOpen] = useState(false);
  const staffActive = staff.some((item) => item.to === currentPath);
  // Mobile bar keeps 5 tiles: first four work navs + More; the overflow lives
  // in the More sheet. (The rail renders the full group once, desktop only.)
  const overflowWork = work.slice(4);
  const moreActive = staffActive || overflowWork.some((item) => item.to === currentPath);

  // Escape closes the mobile More sheet.
  useEffect(() => {
    if (!moreOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMoreOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [moreOpen]);

  return (
    <div className={`admin-shell min-h-screen md:grid transition-[grid-template-columns] duration-[250ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${collapsed ? 'md:grid-cols-[4.25rem_minmax(0,1fr)]' : 'md:grid-cols-[14.5rem_minmax(0,1fr)]'} ${collapsed ? 'rail-is-collapsed' : 'rail-is-expanded'}`}>
      <a href="#main" className="skip-to-content">
        Skip to content
      </a>

      {/* Sidebar Rail — fixed bottom bar on mobile, side rail on desktop */}
      <aside className={`admin-bottom-nav flex items-center gap-2 border-b border-slate-200 bg-white/95 px-3 py-3 text-slate-900 shadow-sm md:sticky md:top-0 md:h-screen md:flex-col md:items-stretch md:border-b-0 md:border-r md:border-slate-200 md:px-3 md:py-4 md:overflow-hidden z-20 ${collapsed ? 'rail-collapsed' : ''}`}>
        <div className="hidden min-w-0 px-1 md:block">
          {collapsed ? (
            <div className="group/logo relative flex h-8 w-full items-center justify-center">
              <PlatformBrand size="sm" collapsed />
              {/* Hover-reveal toggle over the logo, like the client sidebar */}
              <div
                className={[
                  'absolute inset-0 z-30 flex items-center justify-center',
                  'rounded-xl bg-white/85 opacity-0 shadow-sm backdrop-blur-[2px]',
                  'pointer-events-none transition-all duration-200 ease-out',
                  'group-hover/logo:pointer-events-auto group-hover/logo:opacity-100',
                  'group-focus-within/logo:pointer-events-auto group-focus-within/logo:opacity-100',
                ].join(' ')}
              >
                <button
                  type="button"
                  onClick={toggleCollapsed}
                  aria-label="Expand sidebar"
                  aria-expanded={false}
                  title="Expand sidebar"
                  className="rail-collapse-toggle flex h-7 w-7 items-center justify-center rounded-full"
                >
                  <ChevronsLeft className="h-3.5 w-3.5 rotate-180" strokeWidth={1.8} />
                </button>
              </div>
            </div>
          ) : (
            <div className="flex min-w-0 items-center justify-between gap-1.5">
              <PlatformBrand size="sm" />
              {/* Collapse toggler — right of the brand; rotating chevron like the client sidebar */}
              <button
                type="button"
                onClick={toggleCollapsed}
                aria-expanded={true}
                aria-label="Collapse sidebar"
                title="Collapse sidebar"
                className="rail-collapse-toggle flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
              >
                <ChevronsLeft
                  className="h-4 w-4 transition-transform duration-[250ms] ease-out"
                  strokeWidth={1.8}
                />
              </button>
            </div>
          )}
        </div>

        <nav className="flex min-w-0 flex-1 justify-between gap-1 md:mt-6 md:flex-col md:gap-3 md:overflow-y-auto">
          <NavGroup label="Work" items={work} overflowFrom={4} />
          {/* Mobile: first four work tiles render; the rest live in the More
              sheet. Desktop: the full Work group renders once (the earlier
              split rendered a second "WORK" heading on desktop). */}
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            aria-haspopup="dialog"
            aria-expanded={moreOpen}
            className={`rail-nav-item rail-more-toggle mobile-tile md:hidden ${moreActive ? 'rail-more-active' : ''}`}
            title="More"
          >
            <span className="rail-nav-icon">
              <MoreVertical className="h-4 w-4" strokeWidth={moreActive ? 2.2 : 1.8} />
            </span>
            <span>More</span>
          </button>
          <div className="hidden md:contents">
            <NavGroup label="Staff & Security" items={staff} />
          </div>
        </nav>

        {/* Operator Profile Card — removed; Topbar operator menu owns sign-out */}
      </aside>

      {/* Mobile "More" bottom sheet — packed navs from the bottom bar */}
      {moreOpen ? (
        <div className="fixed inset-0 z-50 flex items-end md:hidden" role="presentation">
          <button
            type="button"
            className="absolute inset-0 bg-black/45 backdrop-blur-[4px]"
            onClick={() => setMoreOpen(false)}
            aria-label="Close menu"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="More navigation"
            className="relative w-full rounded-t-2xl border-t border-slate-200 bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-[0_-12px_40px_rgba(15,23,42,0.18)]"
          >
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-slate-200" aria-hidden />
            {overflowWork.length > 0 ? (
              <>
                <p className="px-1 pb-1 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
                  More pages
                </p>
                <nav className="flex flex-col gap-1">
                  {overflowWork.map((item) => {
                    const Icon = ICONS[item.to] ?? LayoutDashboard;
                    return (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        onClick={() => setMoreOpen(false)}
                        className={({ isActive }) =>
                          `flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-semibold transition ${
                            isActive
                              ? 'bg-indigo-50 text-[#3b22c7]'
                              : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                          }`
                        }
                      >
                        <Icon className="h-4 w-4" strokeWidth={2} />
                        {item.label}
                      </NavLink>
                    );
                  })}
                </nav>
              </>
            ) : null}
            <p className="mt-2 px-1 pb-1 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
              Staff &amp; Security
            </p>
            <nav className="flex flex-col gap-1">
              {staff.map((item) => {
                const Icon = ICONS[item.to] ?? LayoutDashboard;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={() => setMoreOpen(false)}
                    className={({ isActive }) =>
                      `flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-semibold transition ${
                        isActive
                          ? 'bg-indigo-50 text-[#3b22c7]'
                          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                      }`
                    }
                  >
                    <Icon className="h-4 w-4" strokeWidth={2} />
                    {item.label}
                  </NavLink>
                );
              })}
            </nav>
            {/* Sign out moved here from the parked breadcrumb header (mobile had no other exit). */}
            <button
              type="button"
              onClick={() => {
                setMoreOpen(false);
                void logout();
              }}
              className="mt-2 flex items-center gap-3 rounded-xl border border-slate-200 px-3 py-2.5 text-[13px] font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              <LogOut className="h-4 w-4" strokeWidth={2} />
              Sign out
            </button>
          </div>
        </div>
      ) : null}

      {/* Main Content Area */}
      <div className="flex min-w-0 flex-col">
        {/* Sticky topbar tracking the active page (client AppTopbar port,
            admin-essential subset). Replaces the parked breadcrumb header. */}
        <Topbar />

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
