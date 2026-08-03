import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ChevronDown,
  LogOut,
  Menu,
  Search,
  Settings2,
} from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { getPageMeta } from '../../config/pageMeta';
import { useAuth } from '../../contexts/AuthContext';
import { useWhatsAppNumber } from '../../contexts/WhatsAppNumberContext';
import type { OrgRole } from '../../types';
import GlobalSearch, { useGlobalSearchShortcut } from './GlobalSearch';
import NotificationCenter from './NotificationCenter';
import NumberSwitcher, { NumberSwitcherMobile } from './NumberSwitcher';
import { PAGE_GUTTER_X } from '../ui/PageShell';

const USER_MENU_WIDTH = 220;
const USER_MENU_GAP = 12;

interface AppTopbarProps {
  companyName?: string;
  userName?: string;
  onMenuOpen?: () => void;
  onLogout?: () => void;
}

function roleLabel(role: OrgRole | null | undefined): string {
  if (role === 'OWNER') return 'Owner';
  if (role === 'ADMIN') return 'Admin';
  if (role === 'AGENT') return 'Agent';
  return 'Member';
}

function nameInitials(name?: string): string {
  if (!name?.trim()) return 'U';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`.toUpperCase();
  }
  return parts[0].slice(0, 2).toUpperCase();
}

function useIsApplePlatform() {
  const [isApple, setIsApple] = useState(true);
  useEffect(() => {
    const ua = navigator.userAgent || '';
    const platform = (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData
      ?.platform;
    setIsApple(/Mac|iPhone|iPad|iPod/i.test(platform || navigator.platform || ua));
  }, []);
  return isApple;
}

export default function AppTopbar({ companyName, userName, onMenuOpen, onLogout }: AppTopbarProps) {
  const { pathname } = useLocation();
  const { orgRole } = useAuth();
  const { hasConnectedNumber, loading: numbersLoading } = useWhatsAppNumber();
  const { title, description } = getPageMeta(pathname);
  const initials = nameInitials(userName);
  const roleText = roleLabel(orgRole);
  const [searchOpen, setSearchOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [userMenuPos, setUserMenuPos] = useState<{ top: number; right: number } | null>(null);
  const userTriggerRef = useRef<HTMLButtonElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const isApple = useIsApplePlatform();
  // Live = WhatsApp number linked (after numbers finish loading). Not a socket
  // heartbeat — topbar has no inbox socket; match NumberSwitcher / Inbox header.
  const showLive = !numbersLoading && hasConnectedNumber;

  useGlobalSearchShortcut(() => setSearchOpen(true));

  useLayoutEffect(() => {
    if (!userMenuOpen || !userTriggerRef.current) {
      setUserMenuPos(null);
      return;
    }
    const place = () => {
      const btn = userTriggerRef.current;
      if (!btn) return;
      const rect = btn.getBoundingClientRect();
      const right = Math.min(
        Math.max(USER_MENU_GAP, window.innerWidth - rect.right),
        Math.max(USER_MENU_GAP, window.innerWidth - USER_MENU_WIDTH - USER_MENU_GAP)
      );
      setUserMenuPos({ top: rect.bottom + USER_MENU_GAP, right });
    };
    place();
    const raf = window.requestAnimationFrame(place);
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [userMenuOpen]);

  useEffect(() => {
    if (!userMenuOpen) return;
    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (userTriggerRef.current?.contains(target)) return;
      if (userMenuRef.current?.contains(target)) return;
      setUserMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setUserMenuOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [userMenuOpen]);

  const subtitle = (description || '').replace(/\.$/, '');

  const userMenu =
    userMenuOpen && userMenuPos
      ? createPortal(
          <div
            ref={userMenuRef}
            role="menu"
            style={{
              top: userMenuPos.top,
              right: userMenuPos.right,
              width: USER_MENU_WIDTH,
            }}
            className="fixed z-[80] overflow-hidden rounded-2xl border border-neutral-200/90 bg-white p-1.5 shadow-lg dark:border-theme-border dark:bg-theme-surface"
          >
            <div className="border-b border-neutral-100 px-3 py-2.5 dark:border-theme-border sm:hidden">
              <p className="truncate text-[13px] font-bold text-neutral-900 dark:text-theme-fg">
                {userName || 'User'}
              </p>
              <p className="truncate text-[11.5px] font-medium text-neutral-500">{roleText}</p>
            </div>
            <Link
              to="/settings"
              role="menuitem"
              onClick={() => setUserMenuOpen(false)}
              className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[13px] font-semibold text-neutral-800 transition hover:bg-neutral-50 dark:text-theme-fg dark:hover:bg-theme-subtle"
            >
              <Settings2 className="h-4 w-4 text-neutral-500" />
              Settings
            </Link>
            {onLogout && (
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setUserMenuOpen(false);
                  onLogout();
                }}
                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-[13px] font-semibold text-rose-700 transition hover:bg-rose-50 dark:hover:bg-rose-500/10"
              >
                <LogOut className="h-4 w-4" />
                Log out
              </button>
            )}
          </div>,
          document.body
        )
      : null;

  return (
    <>
      <header className="topbar-glass sticky top-0 z-40 shrink-0">
        <div
          className={`flex min-h-[72px] items-center gap-3 py-3 lg:min-h-[76px] lg:gap-5 lg:py-3.5 ${PAGE_GUTTER_X}`}
        >
          {onMenuOpen && (
            <button
              type="button"
              onClick={onMenuOpen}
              className="topbar-icon-btn md:hidden"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" strokeWidth={2} />
            </button>
          )}

          {/* Left — page title + live + subtitle */}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-[18px] font-bold leading-none tracking-tight text-neutral-900 sm:text-[20px] dark:text-theme-fg">
                {title}
              </h1>
              {showLive ? (
                <span
                  className="inline-flex h-5 items-center rounded-full bg-emerald-50 px-2 text-[10px] font-bold uppercase tracking-[0.06em] text-emerald-700 ring-1 ring-emerald-100/90 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-500/20 motion-reduce:animate-none"
                  title="WhatsApp connected — live updates available"
                >
                  Live
                </span>
              ) : null}
            </div>
            {subtitle ? (
              <p className="mt-1 truncate text-[12px] font-semibold leading-snug text-neutral-700 sm:text-[13px] dark:text-neutral-300">
                {subtitle}
              </p>
            ) : null}
          </div>

          {/* Right — search, notifications, profile */}
          <div className="flex shrink-0 items-center gap-3 sm:gap-3.5 lg:gap-4">
            <NumberSwitcherMobile />
            <NumberSwitcher />

            {/* Search — design pill; opens command palette */}
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="topbar-search hidden min-w-0 items-center gap-3 md:flex"
              aria-label="Search anything"
            >
              <Search className="h-[17px] w-[17px] shrink-0 text-neutral-400" strokeWidth={2} />
              <span className="min-w-0 flex-1 truncate text-left text-[13.5px] font-medium text-neutral-400">
                Search anything...
              </span>
              <span className="topbar-kbd-group" aria-hidden>
                <kbd className={`topbar-kbd ${isApple ? 'topbar-kbd--mod' : 'topbar-kbd--ctrl'}`}>
                  {isApple ? '⌘' : 'Ctrl'}
                </kbd>
                <kbd className="topbar-kbd topbar-kbd--key">K</kbd>
              </span>
            </button>

            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="topbar-icon-btn md:hidden"
              aria-label="Search"
              title="Search (⌘K)"
            >
              <Search className="h-[17px] w-[17px]" strokeWidth={2} />
            </button>

            <NotificationCenter />

            {/* User profile chip — menu portaled to body so it clears inbox chrome */}
            <div className="relative">
              <button
                ref={userTriggerRef}
                type="button"
                onClick={() => setUserMenuOpen((v) => !v)}
                className="topbar-user-chip"
                aria-label="Account menu"
                aria-expanded={userMenuOpen}
                aria-haspopup="menu"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[0.625rem] bg-[#16a34a] text-[12px] font-bold tracking-wide text-white sm:h-10 sm:w-10 sm:text-[13px]">
                  {initials}
                </span>
                <span className="hidden min-w-0 flex-1 text-left sm:block">
                  <span className="block max-w-[160px] truncate text-[13.5px] font-bold leading-tight text-neutral-900 dark:text-theme-fg md:max-w-[190px] lg:max-w-[220px]">
                    {userName || 'User'}
                  </span>
                  <span className="mt-0.5 block max-w-[160px] truncate text-[12px] font-medium leading-tight text-neutral-500 dark:text-theme-muted md:max-w-[190px] lg:max-w-[220px]">
                    {roleText}
                    {companyName ? (
                      <span className="sr-only"> · {companyName}</span>
                    ) : null}
                  </span>
                </span>
                <ChevronDown
                  className={`hidden h-4 w-4 shrink-0 text-neutral-400 transition sm:block ${userMenuOpen ? 'rotate-180' : ''
                    }`}
                  strokeWidth={2}
                />
              </button>
            </div>
          </div>
        </div>
      </header>
      {userMenu}
      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
}
