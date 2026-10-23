import { NavLink, useLocation } from 'react-router-dom';
import { MoreHorizontal } from 'lucide-react';
import { getMobileBottomNav } from '../../config/navigation';
import { useWhatsAppNumber } from '../../contexts/WhatsAppNumberContext';
import { useMetaChannelStatus } from './MetaChannelChips';

interface MobileBottomNavProps {
  onMoreOpen: () => void;
}

function isMoreRouteActive(pathname: string, primaryPaths: string[]): boolean {
  if (primaryPaths.some((p) => p !== '/' && pathname.startsWith(p))) return false;
  if (primaryPaths.includes('/') && (pathname === '/' || pathname === '')) return false;
  return true;
}

export default function MobileBottomNav({ onMoreOpen }: MobileBottomNavProps) {
  const { pathname } = useLocation();
  const { hasConnectedNumber } = useWhatsAppNumber();
  const { facebook, instagram } = useMetaChannelStatus();
  const tabs = getMobileBottomNav({
    whatsapp: hasConnectedNumber,
    facebook: facebook?.connected === true,
    instagram: instagram?.connected === true,
    email: false,
  });
  const moreActive = isMoreRouteActive(
    pathname,
    tabs.map((t) => t.to)
  );

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-[70] border-t border-theme-border bg-theme-surface/95 backdrop-blur-md md:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      aria-label="Primary navigation"
    >
      <div className="flex h-16 items-stretch">
        {tabs.map(({ to, icon: Icon, label, end }) => {
          const isActive = end ? pathname === to : pathname.startsWith(to);
          return (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={`flex min-h-[44px] flex-1 flex-col items-center justify-center gap-0.5 px-1 transition active:scale-[0.98] ${
                isActive
                ? 'text-[#4B2EEB] dark:text-[#A78BFA]'
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
              ? 'text-[#4B2EEB] dark:text-[#A78BFA]'
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
