import { Outlet } from 'react-router-dom';

const SKIP_KEY = 'onboarding-skipped';

/**
 * Previously redirected new workspaces to Settings until WhatsApp was connected.
 * Default landing is now the dashboard (PreConnectDashboard when not connected).
 */
export default function OnboardingGate() {
  return <Outlet />;
}

export function skipOnboardingSetup() {
  localStorage.setItem(SKIP_KEY, '1');
}
