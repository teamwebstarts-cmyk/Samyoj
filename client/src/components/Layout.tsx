import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useSidebarCollapsed } from '../hooks/useSidebarCollapsed';
import { isBuilderRoute, shouldShowMobileBottomNav } from '../config/pageMeta';
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

  const showBottomNav = shouldShowMobileBottomNav(pathname);
  const hideTopbar = isBuilderRoute(pathname);

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

  const sidebarProps = {
    onLogout: handleLogout,
    onNavigate: () => setMobileOpen(false),
  };

  return (
    <CallNotificationProvider>
      <div className="flex h-[100dvh] overflow-hidden platform-gradient">
        <aside
          className={`hidden shrink-0 border-r border-theme-border bg-theme-surface transition-[width] duration-300 ease-in-out lg:block ${
            collapsed ? 'w-[72px]' : 'w-[260px]'
          }`}
        >
          <Sidebar {...sidebarProps} collapsed={collapsed} collapsible onToggleCollapse={toggle} />
        </aside>

        <div
          className={`fixed inset-0 z-50 lg:hidden ${mobileOpen ? 'pointer-events-auto' : 'pointer-events-none'}`}
          aria-hidden={!mobileOpen}
        >
          <button
            type="button"
            className={`absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-300 dark:bg-black/70 ${
              mobileOpen ? 'opacity-100' : 'opacity-0'
            }`}
            onClick={() => setMobileOpen(false)}
            aria-label="Close menu overlay"
          />
          <aside
            className={`absolute left-0 top-0 h-full w-[min(300px,90vw)] shadow-panel transition-transform duration-300 ease-out ${
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
              onMenuOpen={showBottomNav ? undefined : () => setMobileOpen(true)}
              onLogout={handleLogout}
            />
          )}

          {!hideTopbar && <QualityRatingBanner />}

          <main
            className={`platform-gradient-subtle flex-1 overflow-auto ${
              showBottomNav ? 'pb-[calc(4rem+env(safe-area-inset-bottom,0px))] lg:pb-0' : ''
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
