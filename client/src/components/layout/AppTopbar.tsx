import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ChevronDown,
  ChevronRight,
  Headphones,
  LogOut,
  Menu,
  Search,
  Settings2,
} from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import {
  getPageMeta,
  getTemplateWizardTopbarLabel,
  isCampaignWizardRoute,
  isFlowBuilderRoute,
  isTemplateWizardRoute,
} from '../../config/pageMeta';
import { useAuth } from '../../contexts/AuthContext';
import { useTopbarExtras } from '../../contexts/TopbarContext';
import { useWhatsAppNumber } from '../../contexts/WhatsAppNumberContext';
import { whatsappNotConnectedCopy } from '../../utils/whatsappConnectionCopy';
import {
  dashboardDescription,
  isWhatsAppSurface,
  topbarConnectionBadge,
  topbarLiveTitle,
  topbarNotConnectedTitle,
} from '../../utils/workspaceChannels';
import { useMetaChannelStatus } from './MetaChannelChips';
import { useGmailChannelAvailable } from '../email/emailData';
import type { OrgRole } from '../../types';
import GlobalSearch, { useGlobalSearchShortcut } from './GlobalSearch';
import NotificationCenter from './NotificationCenter';
import NumberSwitcher, { NumberSwitcherMobile } from './NumberSwitcher';
import SupportBoard from '../support/SupportBoard';

const USER_MENU_WIDTH = 240;
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
  const { pathname, search } = useLocation();
  const { orgRole } = useAuth();
  const { extras: topbarExtras } = useTopbarExtras();
  const { hasConnectedNumber, disconnectedNumbers, loading: numbersLoading } = useWhatsAppNumber();
  const { facebook, instagram } = useMetaChannelStatus();
  const { title, description } = getPageMeta(pathname);
  const isCampaignWizard = isCampaignWizardRoute(pathname);
  const isTemplateWizard = isTemplateWizardRoute(pathname);
  const isFlowBuilder = isFlowBuilderRoute(pathname);
  const templateWizardLabel = getTemplateWizardTopbarLabel(pathname);
  const wizardLabel = pathname === '/campaigns/new' ? 'New campaign' : 'Edit campaign';
  const wizardStatus =
    pathname === '/campaigns/new'
      ? 'Draft'
      : new URLSearchParams(search).get('status')?.toLowerCase() || '';
  const initials = nameInitials(userName);
  const roleText = roleLabel(orgRole);
  const [searchOpen, setSearchOpen] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [userMenuPos, setUserMenuPos] = useState<{ top: number; right: number } | null>(null);
  const userTriggerRef = useRef<HTMLButtonElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const isApple = useIsApplePlatform();
  const isDashboard = pathname === '/' || pathname === '';
  const metaReady = facebook !== null && instagram !== null;
  const emailChannel = useGmailChannelAvailable();
  const channels = {
    whatsapp: hasConnectedNumber,
    facebook: facebook?.connected === true,
    instagram: instagram?.connected === true,
    email: emailChannel,
  };
  const connectionBadge = topbarConnectionBadge(pathname, channels, {
    numbersReady: !numbersLoading,
    metaReady,
  });
  const showLive = connectionBadge === 'live';
  const showNotConnected = connectionBadge === 'not-connected';
  const disconnectedCopy = whatsappNotConnectedCopy(disconnectedNumbers);
  const notConnectedBadgeText =
    isWhatsAppSurface(pathname) && disconnectedCopy.disconnected ? 'Disconnected' : 'Not connected';
  const notConnectedTitle = isWhatsAppSurface(pathname)
    ? disconnectedCopy.description
    : topbarNotConnectedTitle(pathname);

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

  const subtitle = (
    isDashboard
      ? dashboardDescription(channels)
      : isTemplateWizard
        ? topbarExtras.subtitle || ''
        : description || ''
  ).replace(/\.$/, '');

  const titleLinkClass =
    'truncate text-[15px] font-bold leading-none tracking-tight text-neutral-500 transition hover:text-neutral-800 sm:text-[18px] md:text-[20px] dark:text-neutral-400 dark:hover:text-neutral-100';
  const titleCurrentClass =
    'truncate text-[15px] font-bold leading-none tracking-tight text-neutral-900 sm:text-[18px] md:text-[20px] dark:text-theme-fg';

  const userAvatar = (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[0.625rem] bg-whatsapp-500 text-[12px] font-bold tracking-wide text-white sm:h-10 sm:w-10 sm:text-[13px]">
      {initials}
    </span>
  );

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
            <div className="flex items-center gap-2.5 rounded-xl bg-neutral-50/80 px-2.5 py-2.5 dark:bg-theme-subtle/50">
              {userAvatar}
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-bold text-neutral-900 dark:text-theme-fg">
                  {userName || 'User'}
                </p>
                <p className="truncate text-[11px] font-medium text-neutral-500 dark:text-theme-muted">
                  {roleText}
                  {companyName ? ` · ${companyName}` : ''}
                </p>
              </div>
            </div>
            <div className="mt-1.5 space-y-0.5 border-t border-neutral-100 pt-1.5 dark:border-theme-border">
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
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <>
      <header className="topbar-glass sticky top-0 z-40 shrink-0">
        <div
          className="topbar-gutter-x flex min-h-[var(--density-topbar-min-h)] items-center gap-3 py-3 lg:min-h-[var(--density-topbar-min-h-lg)] lg:gap-5 lg:py-3.5"
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

          {/* Left — page title/context + live + subtitle */}
          <div className="min-w-0 flex-1">
            {isCampaignWizard ? (
              <>
                <div className="flex min-w-0 items-center gap-1.5 sm:flex-wrap sm:gap-2">
                  <Link to="/campaigns" className={titleLinkClass}>
                    Campaigns
                  </Link>
                  <ChevronRight
                    className="h-3.5 w-3.5 shrink-0 text-neutral-300 sm:h-4 sm:w-4 dark:text-slate-600"
                    aria-hidden
                  />
                  <h1 className={titleCurrentClass}>{wizardLabel}</h1>
                  {wizardStatus ? (
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                      {wizardStatus}
                    </span>
                  ) : null}
                </div>
                {subtitle ? (
                  <p className="mt-1 hidden truncate text-[12px] font-semibold leading-snug text-neutral-700 sm:block sm:text-[13px] dark:text-neutral-300">
                    {subtitle}
                  </p>
                ) : null}
              </>
            ) : isTemplateWizard ? (
              <>
                <div className="flex min-w-0 items-center gap-1.5 sm:flex-wrap sm:gap-2">
                  <Link to="/templates" className={titleLinkClass}>
                    Templates
                  </Link>
                  <ChevronRight
                    className="h-3.5 w-3.5 shrink-0 text-neutral-300 sm:h-4 sm:w-4 dark:text-slate-600"
                    aria-hidden
                  />
                  <h1 className={titleCurrentClass}>{templateWizardLabel}</h1>
                  {topbarExtras.badge ? (
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                      {topbarExtras.badge}
                    </span>
                  ) : null}
                  {showLive ? (
                    <span
                      className="hidden h-5 items-center rounded-full bg-emerald-50 px-2 text-[10px] font-bold uppercase tracking-[0.06em] text-emerald-700 ring-1 ring-emerald-100/90 sm:inline-flex dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-500/20 motion-reduce:animate-none"
                      title={topbarLiveTitle(pathname)}
                    >
                      Live
                    </span>
                  ) : showNotConnected ? (
                    <span
                      className="hidden h-5 items-center rounded-full bg-[#FFF1E8] px-2.5 text-[11px] font-bold text-[#E67E22] ring-1 ring-[#FFD8BF]/90 sm:inline-flex dark:bg-orange-500/15 dark:text-orange-300 dark:ring-orange-500/25"
                      title={notConnectedTitle}
                    >
                      {notConnectedBadgeText}
                    </span>
                  ) : null}
                </div>
                {subtitle ? (
                  <p className="mt-1 hidden truncate text-[12px] font-semibold leading-snug text-neutral-700 sm:block sm:text-[13px] dark:text-neutral-300">
                    {subtitle}
                  </p>
                ) : null}
              </>
            ) : isFlowBuilder ? (
              <>
                <div className="flex min-w-0 items-center gap-1.5 sm:flex-wrap sm:gap-2">
                  <Link to="/automations" className={titleCurrentClass}>
                    Automations
                  </Link>
                </div>
                <p className="mt-1 hidden truncate text-[12px] font-semibold leading-snug text-neutral-700 sm:block sm:text-[13px] dark:text-neutral-300">
                  Flow builder
                </p>
              </>
            ) : (
              <>
                <div className="flex min-w-0 items-center gap-1.5 sm:flex-wrap sm:gap-2">
                  <h1 className="truncate text-[15px] font-bold leading-none tracking-tight text-neutral-900 sm:text-[18px] md:text-[20px] dark:text-theme-fg">
                    {title}
                  </h1>
                  {showLive ? (
                    <span
                      className="hidden h-5 items-center rounded-full bg-emerald-50 px-2 text-[10px] font-bold uppercase tracking-[0.06em] text-emerald-700 ring-1 ring-emerald-100/90 sm:inline-flex dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-500/20 motion-reduce:animate-none"
                      title={topbarLiveTitle(pathname)}
                    >
                      Live
                    </span>
                  ) : showNotConnected ? (
                    <span
                      className="hidden h-5 items-center rounded-full bg-[#FFF1E8] px-2.5 text-[11px] font-bold text-[#E67E22] ring-1 ring-[#FFD8BF]/90 sm:inline-flex dark:bg-orange-500/15 dark:text-orange-300 dark:ring-orange-500/25"
                      title={notConnectedTitle}
                    >
                      {notConnectedBadgeText}
                    </span>
                  ) : null}
                </div>
                {subtitle ? (
                  <p className="mt-1 hidden truncate text-[12px] font-semibold leading-snug text-neutral-700 sm:block sm:text-[13px] dark:text-neutral-300">
                    {subtitle}
                  </p>
                ) : null}
              </>
            )}
          </div>

          {/* Right — flow actions, help, search, notifications, profile */}
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-3.5 lg:gap-4">
            {topbarExtras.actions ? (
              <div className="flex items-center gap-1.5 sm:gap-2">{topbarExtras.actions}</div>
            ) : null}
            <NumberSwitcherMobile />
            <NumberSwitcher />

            <Link
              to="/help"
              className="topbar-icon-btn sm:hidden"
              aria-label="Help assistant"
              title="Help assistant"
            >
              <Headphones className="h-[17px] w-[17px]" strokeWidth={2} />
            </Link>
            <button
              type="button"
              onClick={() => setSupportOpen(true)}
              className="hidden shrink-0 whitespace-nowrap items-center gap-1.5 text-[13px] font-semibold text-neutral-600 transition hover:text-neutral-900 sm:inline-flex dark:text-neutral-300 dark:hover:text-theme-fg"
            >
              <Headphones className="h-4 w-4 text-neutral-400" strokeWidth={2} />
              Help
            </button>

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
                {userAvatar}
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
      <SupportBoard open={supportOpen} onClose={() => setSupportOpen(false)} />
    </>
  );
}
