import {
  Building2,
  LayoutDashboard,
  LogOut,
  Mail,
  ScrollText,
  TriangleAlert,
  Users,
} from 'lucide-react';
import { NavLink, Outlet } from 'react-router-dom';
import { useOperator } from '../context/OperatorContext';
import { visibleNavGroups } from '../lib/routes';
import { PlatformBrand } from './PlatformBrand';
import { StatusBadge } from './ui';

const ICONS: Record<string, typeof LayoutDashboard> = {
  '/': LayoutDashboard,
  '/accounts': Building2,
  '/errors': TriangleAlert,
  '/outreach': Mail,
  '/operators': Users,
  '/audit': ScrollText,
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
    <div className="flex gap-1 md:flex-col md:gap-0.5">
      <p className="hidden px-1.5 pb-0.5 pt-0.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-white/35 md:block">
        {label}
      </p>
      {items.map((item) => {
        const Icon = ICONS[item.to] ?? LayoutDashboard;
        return (
          <NavLink key={item.to} to={item.to} end={item.to === '/'} className="rail-nav-item">
            {({ isActive }) => (
              <>
                <span className="rail-nav-icon">
                  <Icon className="h-3.5 w-3.5" strokeWidth={isActive ? 2.2 : 1.9} />
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
  if (!operator) return null;

  const { work, staff } = visibleNavGroups(operator.role);

  return (
    <div className="min-h-screen md:grid md:grid-cols-[12.75rem_minmax(0,1fr)]">
      <a href="#main" className="skip-to-content">
        Skip to content
      </a>
      <aside
        className="flex items-center gap-2 border-b border-white/5 bg-graphite px-2.5 py-2.5 text-white md:sticky md:top-0 md:h-screen md:flex-col md:items-stretch md:border-b-0 md:px-2.5 md:py-4"
      >
        <div className="hidden min-w-0 px-0.5 md:block">
          <PlatformBrand size="sm" />
          <p className="mt-1.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-white/38">
            Platform console
          </p>
        </div>
        <div className="px-0.5 md:hidden">
          <PlatformBrand size="sm" collapsed />
        </div>
        <nav className="flex min-w-0 flex-1 gap-2 overflow-x-auto md:mt-5 md:flex-col md:gap-4">
          <NavGroup label="Work" items={work} />
          <NavGroup label="Staff" items={staff} />
        </nav>
        <button
          type="button"
          onClick={() => void logout()}
          className="hidden items-center gap-1.5 rounded-lg px-2 py-1.5 text-left text-[11px] text-white/55 hover:bg-white/5 hover:text-white md:flex"
        >
          <LogOut className="h-3.5 w-3.5" />
          Sign out
        </button>
      </aside>
      <div className="flex min-w-0 flex-col">
        <header className="border-b border-dust bg-white/90 px-4 py-2.5 backdrop-blur-sm md:px-6">
          <div className="content-shell flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink/40">
                Operator
              </p>
              <p className="truncate text-sm text-ink/75">
                {operator.email}
                <span className="ml-2 inline-flex align-middle">
                  <StatusBadge status={operator.role} />
                </span>
              </p>
            </div>
            <button
              type="button"
              onClick={() => void logout()}
              className="text-sm font-medium text-ink/60 hover:text-ink md:hidden"
            >
              Sign out
            </button>
          </div>
        </header>
        <main id="main" className="flex-1 px-4 py-4 md:px-6 md:py-5">
          <div className="content-shell">
            <Outlet />
          </div>
        </main>
        <footer className="px-4 pb-4 text-[11px] leading-relaxed text-ink/45 md:px-6">
          <div className="content-shell">
            Account telemetry (logins, feature use, error codes, token counts) is processed to operate and
            support Samyoj. Customer chat, phones, and Meta tokens stay out of this console.
          </div>
        </footer>
      </div>
    </div>
  );
}
