import { useState } from 'react';
import {
  Bot,
  ClipboardList,
  CreditCard,
  LayoutDashboard,
  LayoutGrid,
  LineChart,
  LogOut,
  Menu,
  MessageSquare,
  Package,
  Phone,
  Search,
  Send,
  Settings2,
  Sparkles,
  Ticket,
  Users,
  UsersRound,
  Workflow,
  type LucideIcon,
} from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { getPageMeta } from '../../config/pageMeta';
// import ThemeToggle from '../ui/ThemeToggle';
import GlobalSearch, { useGlobalSearchShortcut } from './GlobalSearch';
import NotificationCenter from './NotificationCenter';
import NumberSwitcher, { NumberSwitcherMobile } from './NumberSwitcher';
import { PAGE_GUTTER_X } from '../ui/PageShell';
import { PLATFORM_NAME } from './PlatformBrand';

interface AppTopbarProps {
  companyName?: string;
  userName?: string;
  onMenuOpen?: () => void;
  onLogout?: () => void;
}

const PAGE_ICONS: Array<{ prefix: string; icon: LucideIcon; exact?: boolean }> = [
  { prefix: '/', icon: LayoutDashboard, exact: true },
  { prefix: '/inbox', icon: MessageSquare },
  { prefix: '/calls', icon: Phone },
  { prefix: '/automations', icon: Workflow },
  { prefix: '/ai-bot', icon: Bot },
  { prefix: '/campaigns', icon: Send },
  { prefix: '/templates', icon: ClipboardList },
  { prefix: '/content-studio', icon: Sparkles },
  { prefix: '/commerce', icon: Package },
  { prefix: '/contacts', icon: Users },
  { prefix: '/tickets', icon: Ticket },
  { prefix: '/team', icon: UsersRound },
  { prefix: '/reports', icon: LineChart },
  { prefix: '/billing', icon: CreditCard },
  { prefix: '/settings', icon: Settings2 },
];

function getPageIcon(pathname: string): LucideIcon {
  const match = PAGE_ICONS.find(({ prefix, exact }) =>
    exact ? pathname === prefix : pathname.startsWith(prefix)
  );
  return match?.icon ?? LayoutGrid;
}

export default function AppTopbar({ companyName, userName, onMenuOpen, onLogout }: AppTopbarProps) {
  const { pathname } = useLocation();
  const { title, description } = getPageMeta(pathname);
  const PageIcon = getPageIcon(pathname);
  const initial = userName?.charAt(0).toUpperCase() || 'U';
  const firstName = userName?.split(' ')[0] || 'there';
  const workspace = companyName || PLATFORM_NAME;
  const [searchOpen, setSearchOpen] = useState(false);

  useGlobalSearchShortcut(() => setSearchOpen(true));

  return (
    <>
      <header className="topbar-glass sticky top-0 z-30 shrink-0">
      <div className={`flex min-h-[64px] items-center gap-3 py-2.5 lg:gap-4 lg:py-0 ${PAGE_GUTTER_X}`}>
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

        {/* Page context */}
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="topbar-page-icon hidden sm:flex">
            <PageIcon className="h-[18px] w-[18px]" strokeWidth={2.25} />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-[15px] font-extrabold tracking-tight text-theme-fg lg:text-[17px]">
                {title}
              </h1>
              <span className="hidden rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700 ring-1 ring-emerald-100 lg:inline-flex dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-500/20">
                Live
              </span>
            </div>
            <p className="truncate text-[11px] font-medium text-theme-secondary lg:text-[12px]">
              <span className="lg:hidden">{description}</span>
              <span className="hidden lg:inline">
                {description}
                <span className="mx-1.5 text-theme-muted">·</span>
                <span className="text-theme-muted">
                  {firstName} @ {workspace}
                </span>
              </span>
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex shrink-0 items-center gap-2 lg:gap-2.5">
          <NumberSwitcherMobile />
          <NumberSwitcher />

          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="topbar-icon-btn hidden sm:flex"
            aria-label="Search"
            title="Search (⌘K)"
          >
            <Search className="h-[17px] w-[17px]" strokeWidth={2} />
          </button>

          <NotificationCenter />

          {/* <ThemeToggle variant="compact" /> */}

          <div className="topbar-divider hidden h-8 w-px sm:block" />

          <div className="topbar-user-chip hidden sm:flex">
            <div className="relative shrink-0">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-whatsapp-500 to-emerald-600 text-[12px] font-extrabold text-white shadow-[0_2px_10px_rgba(37,211,102,0.35)]">
                {initial}
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-theme-surface bg-emerald-400 shadow-sm" />
            </div>
            <div className="hidden min-w-0 md:block">
              <p className="max-w-[160px] truncate text-[13px] font-bold leading-tight text-theme-fg">
                {userName || 'User'}
              </p>
              <p className="max-w-[160px] truncate text-[11px] font-medium leading-tight text-theme-muted">
                {workspace}
              </p>
            </div>
          </div>

          {/* Mobile avatar only */}
          <div className="relative sm:hidden">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-whatsapp-500 to-emerald-600 text-[12px] font-extrabold text-white shadow-[0_2px_10px_rgba(37,211,102,0.35)]">
              {initial}
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-theme-surface bg-emerald-400" />
          </div>

          {onLogout && (
            <button
              type="button"
              onClick={onLogout}
              className="topbar-icon-btn topbar-icon-btn--danger"
              aria-label="Log out"
              title="Log out"
            >
              <LogOut className="h-[17px] w-[17px]" strokeWidth={2} />
            </button>
          )}
        </div>
      </div>
      </header>
      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
}
