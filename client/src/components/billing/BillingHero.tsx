import type { LucideIcon } from 'lucide-react';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  CreditCard,
  Lock,
  Users,
  XCircle
} from 'lucide-react';
import type { BillingInfo, BillingUsage } from '../../types';

export type BillingHeroTone = 'emerald' | 'amber' | 'rose' | 'slate' | 'sky';

export interface BillingHeroStat {
  label: string;
  value: number | string;
  hint: string;
  tone: BillingHeroTone;
  icon?: LucideIcon;
}

interface BillingHeroProps {
  info: BillingInfo;
  usage?: BillingUsage | null;
}

const toneStyles: Record<
  BillingHeroTone,
  {
    chip: string;
    icon: LucideIcon;
    valueClass: string;
  }
> = {
  emerald: {
    chip: 'bg-emerald-50 text-[#16a34a] ring-1 ring-emerald-500/20 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-400/25',
    icon: CheckCircle2,
    valueClass: 'text-emerald-700 dark:text-emerald-300',
  },
  amber: {
    chip: 'bg-amber-50 text-[#ea580c] ring-1 ring-amber-500/20 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-400/25',
    icon: Clock,
    valueClass: 'text-amber-700 dark:text-amber-300',
  },
  rose: {
    chip: 'bg-rose-50 text-[#e11d48] ring-1 ring-rose-500/20 dark:bg-rose-950/40 dark:text-rose-300 dark:ring-rose-400/25',
    icon: AlertCircle,
    valueClass: 'text-rose-700 dark:text-rose-300',
  },
  sky: {
    chip: 'bg-sky-50 text-[#0284c7] ring-1 ring-sky-500/20 dark:bg-sky-950/40 dark:text-sky-300 dark:ring-sky-400/25',
    icon: Users,
    valueClass: 'text-[#0f172a] dark:text-white',
  },
  slate: {
    chip: 'bg-slate-50 text-slate-600 ring-1 ring-slate-500/20 dark:bg-slate-950/40 dark:text-slate-400 dark:ring-slate-400/25',
    icon: XCircle,
    valueClass: 'text-slate-700 dark:text-slate-300',
  },
};

export default function BillingHero({ info }: BillingHeroProps) {
  let statusText = 'Active';
  let statusTone: BillingHeroTone = 'emerald';
  let statusIcon = CheckCircle2;
  let title = 'Billing & Subscriptions';
  let description = 'Plan, seats & WhatsApp charges.';
  const workspaceOpen = info.entitlements?.isLocked === false;

  if (workspaceOpen && info.subscriptionStatus && info.subscriptionStatus !== 'trial' && info.subscriptionStatus !== 'active') {
    statusText = 'Open';
    description = 'This workspace is open. You can keep using every feature.';
  } else if (info.subscriptionStatus === 'trial') {
    statusText = 'Trial';
    statusTone = 'amber';
    statusIcon = Clock;
    if (info.trialEndsAt) {
      const days = Math.ceil((new Date(info.trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      if (days > 0) {
        description = `${days} days left in trial. Upgrade to continue using premium features.`;
      } else {
        description = `Trial ending today. Upgrade to continue using premium features.`;
      }
    }
  } else if (info.subscriptionStatus === 'trial_expired') {
    statusText = 'Trial expired';
    statusTone = 'rose';
    statusIcon = AlertCircle;
    description = 'Your trial has expired. Upgrade your plan to restore full access.';
  } else if (info.subscriptionStatus === 'past_due') {
    statusText = 'Payment due';
    statusTone = 'amber';
    statusIcon = AlertCircle;
    description = 'Your recurring payment needs attention. Update billing before the grace period ends.';
  } else if (info.subscriptionStatus === 'grace') {
    statusText = 'Grace period';
    statusTone = 'amber';
    statusIcon = Clock;
    description = 'Your latest plan payment needs attention. Review billing to restore access.';
  } else if (info.subscriptionStatus === 'locked') {
    statusText = 'Account locked';
    statusTone = 'rose';
    statusIcon = Lock;
    description = 'Your account is restricted because the plan is no longer valid. Purchase a valid plan to restore access.';
  } else if (info.subscriptionStatus === 'cancelled') {
    statusText = 'Cancelled';
    statusTone = 'slate';
    statusIcon = XCircle;
    description = 'Your plan period is no longer active. Purchase a valid plan to restore access.';
  } else if (info.subscriptionStatus === 'expired') {
    statusText = 'Plan expired';
    statusTone = 'rose';
    statusIcon = Lock;
    description = 'Your plan period has ended. Purchase a valid plan to restore access.';
  } else if (info.subscriptionStatus === 'paused') {
    statusText = 'Paused';
    statusTone = 'slate';
    statusIcon = Clock;
    description = 'Your subscription is paused. Resume it with the billing team before access is restricted.';
  }

  const stats: BillingHeroStat[] = [
    {
      label: 'Current plan',
      value: info.currentPlan.name,
      hint: info.planExpiresAt || info.currentPeriodEnd
        ? `Valid until ${new Date(info.planExpiresAt || info.currentPeriodEnd || '').toLocaleDateString()}`
        : 'No expiry',
      tone: 'emerald',
      icon: CreditCard,
    },
    {
      label: 'Seats used',
      value: `${info.seatsUsed} / ${info.seatLimit}`,
      hint: 'Active team members',
      tone: 'sky',
      icon: Users,
    },
    {
      label: 'Status',
      value: statusText,
      hint: 'Subscription state',
      tone: statusTone,
      icon: statusIcon,
    },
  ];

  return (
    <section
      aria-label="Billing overview"
      className="rounded-2xl border border-theme-border bg-theme-surface p-4 sm:p-5 md:p-6"
    >
      <div className="flex flex-col gap-4 sm:gap-5 xl:flex-row xl:items-center xl:justify-between xl:gap-8">
        <div className="min-w-0 max-w-xl">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-50 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-sky-700 dark:bg-sky-950/50 dark:text-sky-300">
            <CreditCard className="h-3 w-3" strokeWidth={2.5} />
            Billing & Subscriptions
          </span>
          <h1 className="mt-2 text-xl font-extrabold tracking-tight text-theme-fg sm:text-2xl">
            {title}
          </h1>
          <p className="mt-1 text-xs font-medium text-theme-secondary sm:text-[13px]">
            {description}
          </p>
        </div>

        <div className="grid w-full grid-cols-1 gap-2.5 sm:grid-cols-3 xl:w-auto xl:min-w-0 xl:shrink-0">
          {stats.map((stat) => {
            const config = toneStyles[stat.tone] || toneStyles.emerald;
            const Icon = stat.icon || config.icon;
            return (
              <div
                key={stat.label}
                className="flex min-w-0 items-center gap-2.5 rounded-xl border border-theme-border bg-theme-subtle/30 p-2.5 sm:p-3 xl:w-[155px] 2xl:w-[165px]"
              >
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${config.chip}`}
                >
                  <Icon className="h-4 w-4" strokeWidth={2.25} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[11px] font-bold text-theme-muted">
                    {stat.label}
                  </p>
                  <p
                    className={`mt-0.5 truncate text-base font-extrabold leading-none tracking-tight tabular-nums sm:text-lg ${config.valueClass}`}
                  >
                    {typeof stat.value === 'number' ? stat.value.toLocaleString() : stat.value}
                  </p>
                  <p className="mt-1 hidden truncate text-[10.5px] font-medium text-theme-muted sm:block">
                    {stat.hint}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
