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
import { StatusBadge } from './ui';
import { BrandMark } from './BrandMark';

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
    <div className="flex gap-1 md:flex-col md:space-y-0 md:gap-1">
      <p className="hidden px-2 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/35 md:block">
        {label}
      </p>
      {items.map((item) => {
        const Icon = ICONS[item.to] ?? LayoutDashboard;
        return (
          <NavLink key={item.to} to={item.to} end={item.to === '/'} className="rail-nav-item">
            {({ isActive }) => (
              <>
                <span className="rail-nav-icon">
                  <Icon className="h-4 w-4" strokeWidth={isActive ? 2.2 : 1.9} />
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
    <div className="min-h-screen md:grid md:grid-cols-[15.5rem_1fr]">
      <a href="#main" className="skip-to-content">
        Skip to content
      </a>
      <aside className="flex items-center gap-2 bg-graphite px-3 py-3 text-white md:sticky md:top-0 md:h-screen md:flex-col md:items-stretch md:px-3 md:py-5">
        <div className="flex items-center gap-2.5 px-1">
          <BrandMark inverted size="sm" />
          <div className="hidden min-w-0 md:block">
            <p className="text-sm font-semibold tracking-tight">Samyoj</p>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/40">
              Platform
            </p>
          </div>
        </div>
        <nav className="flex min-w-0 flex-1 gap-3 overflow-x-auto md:mt-8 md:flex-col md:gap-5">
          <NavGroup label="Work" items={work} />
          <NavGroup label="Staff" items={staff} />
        </nav>
        <button
          type="button"
          onClick={() => void logout()}
          className="hidden items-center gap-2 rounded-xl px-2 py-2 text-left text-xs text-white/55 hover:bg-white/5 hover:text-white md:flex"
        >
          <LogOut className="h-3.5 w-3.5" />
          Sign out
        </button>
      </aside>
      <div className="flex min-w-0 flex-col">
        <header className="flex items-center justify-between gap-3 border-b border-dust bg-white px-4 py-3 md:px-8">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink/40">
              Operator console
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
        </header>
        <main id="main" className="flex-1 px-4 py-6 md:px-8 md:py-7">
          <Outlet />
        </main>
        <footer className="px-4 pb-6 text-xs text-ink/45 md:px-8">
          Account telemetry (logins, feature use, error codes, token counts) is processed to operate and
          support Samyoj. Customer chat, phones, and Meta tokens stay out of this console.
        </footer>
      </div>
    </div>
  );
}
