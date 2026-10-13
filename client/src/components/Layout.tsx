import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { resolveSidebarAccent } from '../utils/sidebarChannelAccent';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { useInboxUnreadTotal } from '../hooks/useInboxUnreadTotal';
import { useSidebarCollapsed } from '../hooks/useSidebarCollapsed';
import {
  isBuilderRoute,
  isEmailShellRoute,
  isInboxRoute,
  isCallsShellRoute,
  isListShellRoute,
  isTemplateWizardRoute,
  shouldShowMobileBottomNav,
} from '../config/pageMeta';
import { SupportDrawerProvider, useSupportDrawer } from '../contexts/SupportDrawerContext';
import AppTopbar from './layout/AppTopbar';
import Sidebar from './layout/Sidebar';
import SupportBoard from './support/SupportBoard';
import MobileBottomNav from './layout/MobileBottomNav';
import MobileMoreSheet from './layout/MobileMoreSheet';
import CallNotificationProvider from './calls/CallNotificationProvider';
import QualityRatingBanner from './billing/QualityRatingBanner';
import SubscriptionLockModal, { SubscriptionLockBanner } from './billing/SubscriptionLockModal';
import { useEntitlements } from '../hooks/useEntitlements';
import { TopbarProvider } from '../contexts/TopbarContext';
import { consumeConnectNotice, WhatsAppNumberPickHost } from '../utils/waNumberPick';
import {
  GMAIL_OAUTH_POPUP,
  subscribeChannelOAuthResult,
} from '../utils/channelOAuthPopup';
import { instagramApi } from '../services/api';
import { toastError, toastSuccess } from '../utils/toast';
import { getErrorMessage } from '../utils/errors';

function SupportDrawerHost() {
  const { open, closeSupport } = useSupportDrawer();
  return <SupportBoard open={open} onClose={closeSupport} />;
}

function LayoutShell() {
  const { user, organization, logout } = useAuth();
  const { entitlements } = useEntitlements();
  const subscriptionLocked = Boolean(entitlements?.isLocked);
  const navigate = useNavigate();
  const { pathname, search } = useLocation();
  const sidebarAccent = resolveSidebarAccent(pathname, search);
  const [mobileOpen, setMobileOpen] = useState(false);
  const mobileDrawerRef = useRef<HTMLDivElement>(null);
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
  const lockMainScroll =
    isInboxRoute(pathname) ||
    isEmailShellRoute(pathname) ||
    isCallsShellRoute(pathname) ||
    isListShellRoute(pathname, search) ||
    isTemplateWizardRoute(pathname);

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
    const notice = consumeConnectNotice();
    if (notice) toastSuccess(notice);
  }, []);

  useEffect(() => {
    let lastKey = '';
    return subscribeChannelOAuthResult((message) => {
      if (
        window.name === 'samyoj_facebook_oauth' ||
        window.name === GMAIL_OAUTH_POPUP ||
        sessionStorage.getItem('samyoj_facebook_popup') === '1' ||
        sessionStorage.getItem('samyoj_gmail_popup') === '1'
      ) {
        return;
      }
      const key = `${message.channel}|${message.status}|${message.message || ''}`;
      if (key === lastKey) return;
      lastKey = key;
      if (message.status !== 'success') {
        toastError(message.message || 'Connection was not finished.');
        return;
      }
      void (async () => {
        if (sessionStorage.getItem('ig_after_facebook') === '1') {
          sessionStorage.removeItem('ig_after_facebook');
          try {
            await instagramApi.connect();
          } catch (err) {
            toastError(getErrorMessage(err, 'Instagram did not link. Connect the Page, then try Instagram again.'));
          }
        }
        window.location.reload();
      })();
    });
  }, []);

  useEffect(() => {
    setMoreOpen(false);
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    const drawer = mobileDrawerRef.current;
    if (!drawer) return;
    if (mobileOpen) {
      drawer.removeAttribute('inert');
      return;
    }
    const active = document.activeElement;
    if (active instanceof HTMLElement && drawer.contains(active)) active.blur();
    drawer.setAttribute('inert', '');
  }, [mobileOpen]);

  useEffect(() => {
    void refreshInboxUnread();
  }, [pathname, refreshInboxUnread]);

  const sidebarProps = {
    onNavigate: () => setMobileOpen(false),
    inboxUnread,
  };

  return (
    <CallNotificationProvider>
      <TopbarProvider>
      <div className="flex h-[100dvh] overflow-hidden platform-gradient">
        <aside
          data-sidebar-accent={sidebarAccent}
          className={`sidebar-glass hidden h-full min-h-0 shrink-0 overflow-hidden transition-[width] duration-[250ms] ease-[cubic-bezier(0.22,1,0.36,1)] md:block ${
            effectiveCollapsed ? 'w-[var(--density-sidebar-collapsed)]' : 'w-[var(--density-sidebar-width)]'
          }`}
        >
          <Sidebar
            {...sidebarProps}
            collapsed={effectiveCollapsed}
            collapsible={isDesktop}
            onToggleCollapse={isDesktop ? toggle : undefined}
          />
        </aside>

        {isMobile ? (
        <div
          ref={mobileDrawerRef}
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
            data-sidebar-accent={sidebarAccent}
            className={`sidebar-glass absolute left-0 top-0 h-full w-[min(320px,90vw)] overflow-hidden transition-transform duration-[250ms] ease-out ${
              mobileOpen ? 'translate-x-0' : '-translate-x-full'
            }`}
          >
            <Sidebar {...sidebarProps} showClose onClose={() => setMobileOpen(false)} />
          </aside>
        </div>
        ) : null}

        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          {!hideTopbar && (
            <AppTopbar
              companyName={organization?.companyName}
              userName={user?.name}
              onMenuOpen={isMobile ? () => setMobileOpen(true) : undefined}
              onLogout={handleLogout}
            />
          )}

          {!hideTopbar && (
            <div className="mobile-chrome-hide">
              <QualityRatingBanner />
              <SubscriptionLockBanner locked={subscriptionLocked} />
            </div>
          )}

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
          <SubscriptionLockModal locked={subscriptionLocked} />
          <WhatsAppNumberPickHost />

          {showBottomNav && <MobileBottomNav onMoreOpen={() => setMoreOpen(true)} />}
          <MobileMoreSheet open={moreOpen} onClose={() => setMoreOpen(false)} />
          <SupportDrawerHost />
        </div>
      </div>

      </TopbarProvider>
    </CallNotificationProvider>
  );
}

export default function Layout() {
  return (
    <SupportDrawerProvider>
      <LayoutShell />
    </SupportDrawerProvider>
  );
}
