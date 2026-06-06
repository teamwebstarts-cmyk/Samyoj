import { LogOut, Menu } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { getPageMeta } from '../../config/pageMeta';
import { PAGE_GUTTER_X } from '../ui/PageShell';
import { PLATFORM_NAME } from './PlatformBrand';

interface AppTopbarProps {
  companyName?: string;
  userName?: string;
  onMenuOpen?: () => void;
  onLogout?: () => void;
}

export default function AppTopbar({ companyName, userName, onMenuOpen, onLogout }: AppTopbarProps) {
  const { pathname } = useLocation();
  const { title, description } = getPageMeta(pathname);
  const initial = userName?.charAt(0).toUpperCase() || 'U';
  const firstName = userName?.split(' ')[0] || 'there';

  return (
    <header className="topbar-glass sticky top-0 z-30 shrink-0">
      <div className={`flex min-h-[60px] items-center gap-3 py-2 lg:py-0 ${PAGE_GUTTER_X}`}>
        {onMenuOpen && (
          <button
            type="button"
            onClick={onMenuOpen}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-neutral-200/80 bg-white/90 text-neutral-800 shadow-input transition hover:border-whatsapp-500/30 hover:bg-emerald-50 hover:text-whatsapp-800 lg:hidden"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" strokeWidth={2} />
          </button>
        )}

        {/* Page context — all breakpoints */}
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-bold tracking-tight text-neutral-900 lg:text-base">
            {title}
          </p>
          <p className="truncate text-[11px] font-medium text-neutral-600 lg:text-[12px]">
            <span className="lg:hidden">{description}</span>
            <span className="hidden lg:inline">
              Welcome back, {firstName} · {companyName || PLATFORM_NAME}
            </span>
          </p>
        </div>

        {/* User profile */}
        <div className="flex shrink-0 items-center gap-3 rounded-2xl border border-neutral-200/80 bg-white/90 py-1.5 pl-1.5 pr-4 shadow-input backdrop-blur-sm">
          <div className="relative">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-whatsapp-500 to-whatsapp-600 text-xs font-bold text-white shadow-[0_2px_8px_rgba(37,211,102,0.35)]">
              {initial}
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-400" />
          </div>
          <div className="hidden min-w-0 sm:block">
            <p className="max-w-[180px] truncate text-[13px] font-semibold leading-tight text-neutral-900">
              {userName || 'User'}
            </p>
            <p className="max-w-[180px] truncate text-[11px] font-medium leading-tight text-neutral-600">
              {companyName || 'Workspace'}
            </p>
          </div>
        </div>

        {onLogout && (
          <button
            type="button"
            onClick={onLogout}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-neutral-200/80 bg-white/90 text-neutral-800 shadow-input transition hover:border-red-200 hover:bg-red-50 hover:text-red-700"
            aria-label="Log out"
            title="Log out"
          >
            <LogOut className="h-[18px] w-[18px]" strokeWidth={2} />
          </button>
        )}
      </div>
    </header>
  );
}
