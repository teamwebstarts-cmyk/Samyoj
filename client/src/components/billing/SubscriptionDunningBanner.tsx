import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, Clock, Lock, Sparkles, X } from 'lucide-react';
import { billingApi } from '../../services/api';
import type { BillingInfo } from '../../types';

export default function SubscriptionDunningBanner() {
  const [info, setInfo] = useState<BillingInfo | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    billingApi
      .get()
      .then((res) => {
        setInfo(res.data.data);
      })
      .catch(() => {
        /* non-blocking */
      });
  }, []);

  if (dismissed || !info) return null;

  const status = info.subscriptionStatus || 'active';
  const isTrial = status === 'trial';
  const isTrialExpired = status === 'trial_expired';
  const isPastDue = status === 'past_due' || status === 'grace';
  const isLocked = status === 'locked' || status === 'expired';

  // Calculate days remaining if trial
  let trialDaysRemaining: number | null = null;
  if (isTrial && info.planExpiresAt) {
    const diff = Math.ceil(
      (new Date(info.planExpiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );
    trialDaysRemaining = Math.max(0, diff);
  }

  // Only show if there's something actionable
  const showTrialWarning = isTrial && trialDaysRemaining !== null && trialDaysRemaining <= 5;
  if (!isTrialExpired && !isPastDue && !isLocked && !showTrialWarning) {
    return null;
  }

  let bannerConfig = {
    bg: 'bg-amber-500/10 border-amber-500/30 text-amber-900 dark:text-amber-200',
    icon: Clock,
    iconColor: 'text-amber-600 dark:text-amber-400',
    title: 'Trial Ending Soon',
    message: `${trialDaysRemaining} days remaining in your Kickstart trial. Upgrade now to keep premium automation and team features active.`,
    cta: 'Upgrade to Growth',
  };

  if (isTrialExpired) {
    bannerConfig = {
      bg: 'bg-rose-500/10 border-rose-500/30 text-rose-900 dark:text-rose-200',
      icon: AlertCircle,
      iconColor: 'text-rose-600 dark:text-rose-400',
      title: 'Free Trial Expired',
      message: 'Your 14-day Kickstart trial has ended. Upgrade your organization plan to restore sending, bots, and campaign automations.',
      cta: 'Choose a Plan',
    };
  } else if (isPastDue) {
    bannerConfig = {
      bg: 'bg-amber-500/10 border-amber-500/30 text-amber-900 dark:text-amber-200',
      icon: AlertCircle,
      iconColor: 'text-amber-600 dark:text-amber-400',
      title: 'Payment Action Required',
      message: 'Your latest subscription renewal payment could not be processed. Please update your payment method to prevent account suspension.',
      cta: 'Update Payment',
    };
  } else if (isLocked) {
    bannerConfig = {
      bg: 'bg-rose-500/10 border-rose-500/30 text-rose-900 dark:text-rose-200',
      icon: Lock,
      iconColor: 'text-rose-600 dark:text-rose-400',
      title: 'Account Restricted',
      message: 'Your organization access is restricted due to an expired subscription. Upgrade or renew to re-enable full platform capabilities.',
      cta: 'Reactivate Plan',
    };
  }

  const Icon = bannerConfig.icon;

  return (
    <div
      role="alert"
      className={`relative flex items-center justify-between gap-3 border-b px-4 py-2.5 sm:px-6 transition-all animate-fade-in ${bannerConfig.bg}`}
    >
      <div className="flex items-center gap-2.5 min-w-0 flex-1">
        <Icon className={`h-4 w-4 shrink-0 ${bannerConfig.iconColor}`} />
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs sm:text-[13px]">
          <span className="font-bold">{bannerConfig.title}:</span>
          <span className="opacity-90">{bannerConfig.message}</span>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <Link
          to="/billing"
          className="inline-flex items-center gap-1 rounded-full bg-theme-fg px-3 py-1 text-[11px] font-bold text-theme-bg shadow-sm transition hover:opacity-90 dark:bg-white dark:text-slate-900"
        >
          <Sparkles className="h-3 w-3" />
          {bannerConfig.cta}
        </Link>
        {!isLocked && !isTrialExpired && (
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="rounded-md p-1 text-current opacity-60 hover:opacity-100 transition-opacity"
            aria-label="Dismiss banner"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
