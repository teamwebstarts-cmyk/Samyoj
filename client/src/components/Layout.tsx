import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { useInboxUnreadTotal } from '../hooks/useInboxUnreadTotal';
import { useSidebarCollapsed } from '../hooks/useSidebarCollapsed';
import { isBuilderRoute, isInboxRoute, shouldShowMobileBottomNav } from '../config/pageMeta';
import AppTopbar from './layout/AppTopbar';
import Sidebar from './layout/Sidebar';
import MobileBottomNav from './layout/MobileBottomNav';
import MobileMoreSheet from './layout/MobileMoreSheet';
import CallNotificationProvider from './calls/CallNotificationProvider';
import QualityRatingBanner from './billing/QualityRatingBanner';

export default function Layout() {
  const { user, organization, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const { collapsed, toggle } = useSidebarCollapsed();
  const breakpoint = useBreakpoint();
  const { total: inboxUnread, refresh: refreshInboxUnread } = useInboxUnreadTotal();

  const isMobile = breakpoint === 'xs' || breakpoint === 'sm';
  const isTablet = breakpoint === 'md';
  const isDesktop = breakpoint === 'lg' || breakpoint === 'xl';
  const effectiveCollapsed = isTablet || collapsed;
  const showBottomNav = isMobile && shouldShowMobileBottomNav(pathname);
  const hideTopbar = isBuilderRoute(pathname);
  const lockMainScroll = isInboxRoute(pathname);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileOpen]);

  useEffect(() => {
    setMoreOpen(false);
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    void refreshInboxUnread();
  }, [pathname, refreshInboxUnread]);

  const sidebarProps = {
    onNavigate: () => setMobileOpen(false),
    inboxUnread,
  };

  return (
    <CallNotificationProvider>
      <div className="flex h-[100dvh] overflow-hidden platform-gradient">
        <aside
          className={`sidebar-glass hidden shrink-0 overflow-hidden transition-[width] duration-[250ms] ease-[cubic-bezier(0.22,1,0.36,1)] md:block ${
            effectiveCollapsed ? 'w-[76px]' : 'w-[260px]'
          }`}
        >
          <Sidebar
            {...sidebarProps}
            collapsed={effectiveCollapsed}
            collapsible={isDesktop}
            onToggleCollapse={isDesktop ? toggle : undefined}
          />
        </aside>

        <div
          className={`fixed inset-0 z-50 md:hidden ${mobileOpen ? 'pointer-events-auto' : 'pointer-events-none'}`}
          aria-hidden={!mobileOpen}
        >
          <button
            type="button"
            className={`absolute inset-0 bg-black/50 backdrop-blur-[12px] transition-opacity duration-[250ms] dark:bg-black/70 ${
              mobileOpen ? 'opacity-100' : 'opacity-0'
            }`}
            onClick={() => setMobileOpen(false)}
            aria-label="Close menu overlay"
          />
          <aside
            className={`sidebar-glass absolute left-0 top-0 h-full w-[min(320px,90vw)] overflow-hidden transition-transform duration-[250ms] ease-out ${
              mobileOpen ? 'translate-x-0' : '-translate-x-full'
            }`}
          >
            <Sidebar {...sidebarProps} showClose onClose={() => setMobileOpen(false)} />
          </aside>
        </div>

        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          {!hideTopbar && (
            <AppTopbar
              companyName={organization?.companyName}
              userName={user?.name}
              onMenuOpen={isMobile ? () => setMobileOpen(true) : undefined}
              onLogout={handleLogout}
            />
          )}

          {!hideTopbar && <QualityRatingBanner />}

          <main
            className={`app-main-scroll platform-gradient-subtle flex-1 min-h-0 ${
              lockMainScroll
                ? 'flex flex-col overflow-hidden'
                : 'overflow-auto'
            } ${
              showBottomNav ? 'pb-[calc(4rem+env(safe-area-inset-bottom,0px))] md:pb-0' : ''
            }`}
          >
            <Outlet />
          </main>

          {showBottomNav && <MobileBottomNav onMoreOpen={() => setMoreOpen(true)} />}
          <MobileMoreSheet open={moreOpen} onClose={() => setMoreOpen(false)} />
        </div>
      </div>
    </CallNotificationProvider>
  );
}
