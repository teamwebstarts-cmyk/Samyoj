import {
  Building2,
  LayoutDashboard,
  Mail,
  ScrollText,
  TriangleAlert,
  Users,
} from 'lucide-react';
import { NavLink, Outlet } from 'react-router-dom';
import { useOperator } from '../context/OperatorContext';
import { visibleNav } from '../lib/routes';

const ICONS: Record<string, typeof LayoutDashboard> = {
  '/': LayoutDashboard,
  '/accounts': Building2,
  '/errors': TriangleAlert,
  '/outreach': Mail,
  '/operators': Users,
  '/audit': ScrollText,
};

export function Shell() {
  const { operator, logout } = useOperator();
  if (!operator) return null;

  const links = visibleNav(operator.role);

  return (
    <div className="min-h-screen md:grid md:grid-cols-[5.5rem_1fr]">
      <a href="#main" className="skip-to-content">
        Skip to content
      </a>
      <aside className="flex items-center justify-between bg-graphite px-3 py-3 text-white md:flex-col md:items-stretch md:py-6">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sage/25 text-sm font-bold tracking-tight">
          S
        </div>
        <nav className="flex gap-1 overflow-x-auto md:mt-8 md:flex-col md:gap-1">
          {links.map((item) => {
            const Icon = ICONS[item.to] ?? LayoutDashboard;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  `flex min-w-[4.5rem] flex-col items-center gap-1 rounded-md px-2 py-2 text-[10px] font-semibold uppercase tracking-wide md:min-w-0 ${
                    isActive ? 'bg-white/15 text-white' : 'text-white/65 hover:text-white'
                  }`
                }
              >
                <Icon className="h-4 w-4" strokeWidth={2} />
                {item.label}
              </NavLink>
            );
          })}
        </nav>
        <button
          type="button"
          onClick={() => void logout()}
          className="hidden text-[11px] text-white/70 hover:text-white md:block"
        >
          Sign out
        </button>
      </aside>
      <div className="min-w-0">
        <header className="flex items-center justify-between border-b border-dust px-4 py-3 md:px-8">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink/45">
              Samyoj platform
            </p>
            <p className="text-sm text-ink/70">
              {operator.email}
              <span className="ml-2 font-mono text-[11px] uppercase text-ink/40">{operator.role}</span>
            </p>
          </div>
          <button type="button" onClick={() => void logout()} className="text-sm text-ink/60 md:hidden">
            Sign out
          </button>
        </header>
        <main id="main" className="px-4 py-6 md:px-8">
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
