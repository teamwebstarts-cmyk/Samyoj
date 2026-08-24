import {
  AlertCircle,
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Clock,
  Crown,
  Sparkles,
} from 'lucide-react';
import AppButton from '../ui/AppButton';
import type { BillingInfo } from '../../types';

interface BillingCurrentPlanHeroProps {
  info: BillingInfo;
  onUnlockGrowth?: () => void;
  isNearLimit?: boolean;
}

const tierAccents: Record<string, { bg: string; text: string; ring: string; border: string }> = {
  launch: {
    bg: 'bg-emerald-50 dark:bg-emerald-950/40',
    text: 'text-emerald-700 dark:text-emerald-300',
    ring: 'ring-emerald-200 dark:ring-emerald-800',
    border: 'border-emerald-300 dark:border-emerald-800',
  },
  starter: {
    bg: 'bg-emerald-50 dark:bg-emerald-950/40',
    text: 'text-emerald-700 dark:text-emerald-300',
    ring: 'ring-emerald-200 dark:ring-emerald-800',
    border: 'border-emerald-300 dark:border-emerald-800',
  },
  growth: {
    bg: 'bg-violet-50 dark:bg-violet-950/40',
    text: 'text-violet-700 dark:text-violet-300',
    ring: 'ring-violet-200 dark:ring-violet-800',
    border: 'border-violet-300 dark:border-violet-800',
  },
  pro: {
    bg: 'bg-sky-50 dark:bg-sky-950/40',
    text: 'text-sky-700 dark:text-sky-300',
    ring: 'ring-sky-200 dark:ring-sky-800',
    border: 'border-sky-300 dark:border-sky-800',
  },
  enterprise: {
    bg: 'bg-amber-50 dark:bg-amber-950/40',
    text: 'text-amber-700 dark:text-amber-300',
    ring: 'ring-amber-200 dark:ring-amber-800',
    border: 'border-amber-300 dark:border-amber-800',
  },
};

function getStatusInfo(status?: string | null) {
  if (status === 'trial') return { text: 'Trial', color: 'text-amber-700 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-950/40', icon: Clock };
  if (status === 'trial_expired') return { text: 'Trial Expired', color: 'text-rose-700 dark:text-rose-400', bg: 'bg-rose-50 dark:bg-rose-950/40', icon: AlertCircle };
  if (status === 'past_due' || status === 'grace' || status === 'locked') return { text: 'Payment Issue', color: 'text-rose-700 dark:text-rose-400', bg: 'bg-rose-50 dark:bg-rose-950/40', icon: AlertCircle };
  if (status === 'cancelled') return { text: 'Cancelled', color: 'text-slate-600 dark:text-slate-400', bg: 'bg-slate-50 dark:bg-slate-900/40', icon: AlertCircle };
  return { text: 'Active', color: 'text-emerald-700 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/40', icon: CheckCircle2 };
}

export default function BillingCurrentPlanHero({ info, onUnlockGrowth, isNearLimit }: BillingCurrentPlanHeroProps) {
  const status = getStatusInfo(info.subscriptionStatus);
  const StatusIcon = status.icon;
  const planTier = info.planTier || info.plan;
  const accent = tierAccents[planTier] || tierAccents.launch;

  const isBasePlan = planTier === 'launch' || planTier === 'starter';
  const plan = info.currentPlan;

  const expiryDate = info.currentPeriodEnd || info.planExpiresAt;
  const daysLeft = info.trialEndsAt
    ? Math.max(0, Math.ceil((new Date(info.trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null;

  return (
    <div className="rounded-2xl border border-theme-border bg-theme-surface p-4 sm:p-5">
      <div className="flex flex-col gap-3.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          {/* Plan name + badges */}
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-extrabold tracking-tight text-theme-fg sm:text-xl">
              {plan.name} Plan
            </h2>
            <span className={`inline-flex items-center rounded-md px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider ring-1 ring-inset ${accent.bg} ${accent.text} ${accent.ring}`}>
              {planTier}
            </span>
            <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold ring-1 ring-inset ${status.bg} ${status.color} ring-transparent`}>
              <StatusIcon className="h-3 w-3" />
              {status.text}
            </span>
            {info.cadence && info.cadence !== 'trial' && (
              <span className="rounded-md bg-theme-subtle px-2 py-0.5 text-[10.5px] font-semibold text-theme-secondary">
                {info.cadence.charAt(0).toUpperCase() + info.cadence.slice(1)} billing
              </span>
            )}
          </div>

          {/* Expiry & Trial Status */}
          <div className="flex flex-wrap items-center gap-3 text-[12px]">
            {expiryDate && (
              <span className="inline-flex items-center gap-1.5 font-medium text-theme-secondary">
                <CalendarDays className="h-3.5 w-3.5 text-theme-muted" />
                {info.subscriptionStatus === 'trial' ? 'Trial ends' : 'Renews'}{' '}
                <span className="font-semibold text-theme-fg">
                  {new Date(expiryDate).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </span>
              </span>
            )}
            {daysLeft != null && (
              <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-[10.5px] font-bold text-amber-700 ring-1 ring-amber-500/20 dark:bg-amber-950/40 dark:text-amber-400">
                <Clock className="h-3 w-3" />
                {daysLeft} days left in trial
              </span>
            )}
            {isNearLimit && (
              <span className="inline-flex items-center gap-1 rounded-md bg-rose-50 px-2 py-0.5 text-[10.5px] font-bold text-rose-700 ring-1 ring-rose-500/20 dark:bg-rose-950/40 dark:text-rose-300">
                <AlertTriangle className="h-3 w-3" />
                Near limit
              </span>
            )}
          </div>
        </div>

        {/* Action CTA */}
        <div className="flex shrink-0 flex-col items-start gap-1 sm:items-end">
          {isBasePlan ? (
            <AppButton
              variant="primary"
              size="sm"
              className="!bg-violet-600 hover:!bg-violet-700 text-white"
              icon={<Crown size={14} />}
              onClick={onUnlockGrowth}
            >
              Unlock Growth
            </AppButton>
          ) : (
            <AppButton
              variant="secondary"
              size="sm"
              icon={<Sparkles size={14} />}
              onClick={onUnlockGrowth}
            >
              Change Plan
            </AppButton>
          )}
          <span className="text-[10px] font-medium text-theme-muted">
            Cancel or switch anytime
          </span>
        </div>
      </div>
    </div>
  );
}
