import { NavLink, useLocation } from 'react-router-dom';
import { MessageSquare, MoreHorizontal, Send, Users, Zap } from 'lucide-react';

interface MobileBottomNavProps {
  onMoreOpen: () => void;
}

const primaryTabs = [
  { to: '/inbox', icon: MessageSquare, label: 'Inbox' },
  { to: '/campaigns', icon: Send, label: 'Campaigns' },
  { to: '/contacts', icon: Users, label: 'Contacts' },
  { to: '/automations', icon: Zap, label: 'Automations' },
];

function isMoreRouteActive(pathname: string): boolean {
  const morePrefixes = [
    '/',
    '/calls',
    '/ai-bot',
    '/templates',
    '/content-studio',
    '/reports',
    '/team',
    '/billing',
    '/settings',
  ];
  return morePrefixes.some((p) => (p === '/' ? pathname === '/' : pathname.startsWith(p)));
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
        {primaryTabs.map(({ to, icon: Icon, label }) => {
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
