import { NavLink, useLocation } from 'react-router-dom';
import { MoreHorizontal } from 'lucide-react';
import { MOBILE_BOTTOM_NAV } from '../../config/navigation';

interface MobileBottomNavProps {
  onMoreOpen: () => void;
}

function isMoreRouteActive(pathname: string): boolean {
  const primaryPaths = MOBILE_BOTTOM_NAV.map((t) => t.to);
  if (primaryPaths.some((p) => pathname.startsWith(p))) return false;
  return true;
}

export default function MobileBottomNav({ onMoreOpen }: MobileBottomNavProps) {
  const { pathname } = useLocation();
  const moreActive = isMoreRouteActive(pathname);

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-theme-border bg-theme-surface/95 backdrop-blur-md lg:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      aria-label="Primary navigation"
    >
      <div className="flex h-16 items-stretch">
        {MOBILE_BOTTOM_NAV.map(({ to, icon: Icon, label }) => {
          const isActive = pathname.startsWith(to);
          return (
            <NavLink
              key={to}
              to={to}
              className={`flex min-h-[44px] flex-1 flex-col items-center justify-center gap-0.5 px-1 transition active:scale-[0.98] ${
                isActive
                  ? 'text-whatsapp-600 dark:text-whatsapp-400'
                  : 'text-theme-muted hover:text-theme-secondary'
              }`}
            >
              <Icon className="h-5 w-5" strokeWidth={isActive ? 2.25 : 2} />
              <span className="text-micro font-bold">{label}</span>
            </NavLink>
          );
        })}
        <button
          type="button"
          onClick={onMoreOpen}
          className={`flex min-h-[44px] flex-1 flex-col items-center justify-center gap-0.5 px-1 transition active:scale-[0.98] ${
            moreActive
              ? 'text-whatsapp-600 dark:text-whatsapp-400'
              : 'text-theme-muted hover:text-theme-secondary'
          }`}
          aria-label="More navigation options"
          aria-expanded={false}
        >
          <MoreHorizontal className="h-5 w-5" strokeWidth={moreActive ? 2.25 : 2} />
          <span className="text-micro font-bold">More</span>
        </button>
      </div>
    </nav>
  );
}

export { isMoreRouteActive };
