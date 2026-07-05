import { useEffect, useRef, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { onboardingApi } from '../services/api';

const SKIP_KEY = 'onboarding-skipped';
const EXEMPT_PATHS = ['/settings', '/onboarding', '/settings/whatsapp/callback'];

function isExemptPath(pathname: string) {
  return EXEMPT_PATHS.some((p) => pathname.startsWith(p));
}

/**
 * Redirects new workspaces to setup once on first visit until WhatsApp is connected
 * or the user skips. Does not block navigation after the initial redirect.
 */
export default function OnboardingGate() {
  const { pathname, search } = useLocation();
  const [checking, setChecking] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);
  const didRedirectRef = useRef(false);

  useEffect(() => {
    if (localStorage.getItem(SKIP_KEY) === '1') {
      setNeedsSetup(false);
      setChecking(false);
      return;
    }

    onboardingApi
      .readiness()
      .then((res) => {
        const { isReady } = res.data.data;
        setNeedsSetup(!isReady);
      })
      .catch(() => setNeedsSetup(false))
      .finally(() => setChecking(false));
  }, []);

  if (checking) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-whatsapp-500 border-t-transparent" />
      </div>
    );
  }

  if (needsSetup && !isExemptPath(pathname) && !didRedirectRef.current) {
    didRedirectRef.current = true;
    return <Navigate to={`/settings?tab=setup${search}`} replace />;
  }

  return <Outlet />;
}

export function skipOnboardingSetup() {
  localStorage.setItem(SKIP_KEY, '1');
}
