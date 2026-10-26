import { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronRight, LogOut, ShieldCheck } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useOperator } from '../context/OperatorContext';
import { routeMetaForTest as routeMeta } from './Topbar-route-meta';

/**
 * Admin topbar — compact port of the client AppTopbar
 * (client/src/components/layout/AppTopbar.tsx) that tracks the active page:
 * root › title breadcrumb + one-line purpose, live badge, operator chip.
 * Admin-essential subset only — no help drawer, global search, number
 * switcher, or notification center (tenant surfaces, not platform ops).
 * Wayfinding meta lives in Topbar-route-meta.ts (pure, unit-tested).
 */

function initialsOf(email: string): string {
  const local = email.split('@')[0]?.trim();
  if (!local) return 'OP';
  const parts = local.split(/[._\-\s+]+/).filter(Boolean);
  return (parts.length >= 2 ? `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}` : local.slice(0, 2)).toUpperCase();
}

export function Topbar() {
  const { operator, logout } = useOperator();
  const { pathname } = useLocation();
  const { rootTo, root, title, sub, detail } = routeMeta(pathname);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Operator menu closes on route change, outside press, or Escape (client pattern).
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);
  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (e: MouseEvent) => {
      if (menuRef.current?.contains(e.target as Node)) return;
      setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  if (!operator) return null;

  const initials = initialsOf(operator.email);

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/85 backdrop-blur-md px-4 py-2.5 md:px-8">
      <div className="content-shell flex items-center justify-between gap-4">
        {/* Left — active page: root › title (+ detail id), one-line purpose below */}
        <div className="min-w-0">
          <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1">
            {rootTo ? (
              <>
                <Link
                  to={rootTo}
                  className="shrink-0 truncate text-[13px] font-bold text-slate-500 transition-colors hover:text-indigo-600"
                >
                  {root}
                </Link>
                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-300" aria-hidden />
              </>
            ) : null}
            <span className="flex min-w-0 items-center gap-1.5">
              <span className="truncate text-[15px] font-bold leading-tight text-slate-900">{title}</span>
              {detail ? (
                <span className="hidden max-w-[9rem] truncate rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[10.5px] text-slate-600 sm:inline">
                  {detail}
                </span>
              ) : null}
            </span>
            <span className="ml-2 hidden items-center gap-1.5 rounded-full border border-emerald-200/70 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700 sm:inline-flex">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Live
            </span>
          </nav>
          <p className="hidden truncate text-[12px] font-medium leading-snug text-slate-500 sm:block">{sub}</p>
        </div>

        {/* Right — operator chip with sign-out menu. Mobile keeps the initials
            avatar; the rail's More sheet still carries the sign-out action. */}
        <div ref={menuRef} className="relative shrink-0">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Operator menu"
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            className="flex items-center gap-2 rounded-xl p-1 pr-1.5 transition hover:bg-slate-100"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-[11px] font-bold tracking-wide text-white">
              {initials}
            </span>
            <span className="hidden min-w-0 text-left sm:block">
              <span className="block max-w-[11rem] truncate text-[12.5px] font-bold leading-tight text-slate-900">
                {operator.email}
              </span>
              <span className="mt-0.5 block text-[10.5px] font-semibold uppercase leading-tight tracking-wider text-indigo-700">
                {operator.role}
              </span>
            </span>
            <ChevronDown
              className={`hidden h-3.5 w-3.5 shrink-0 text-slate-400 transition sm:block ${menuOpen ? 'rotate-180' : ''}`}
              strokeWidth={2}
              aria-hidden
            />
          </button>

          {menuOpen ? (
            <div
              role="menu"
              aria-label="Operator"
              className="absolute right-0 top-full z-50 mt-1.5 w-64 overflow-hidden rounded-2xl border border-slate-200 bg-white p-1.5 shadow-lg"
            >
              <div className="flex items-start gap-2.5 rounded-xl bg-slate-50/80 px-2.5 py-2">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-[11px] font-bold text-white">
                  {initials}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-[12.5px] font-bold text-slate-900">{operator.email}</p>
                  <p className="mt-0.5 flex items-center gap-1 text-[10.5px] font-semibold uppercase tracking-wider text-indigo-700">
                    {operator.mfaEnabled ? <ShieldCheck className="h-3 w-3" aria-hidden /> : null}
                    {operator.role}
                  </p>
                </div>
              </div>
              <button
                type="button"
                role="menuitem"
                onClick={() => void logout()}
                className="mt-1.5 flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-[13px] font-semibold text-rose-700 transition hover:bg-rose-50"
              >
                <LogOut className="h-4 w-4" aria-hidden />
                Sign out
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
