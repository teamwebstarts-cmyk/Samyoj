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

  if (info.subscriptionStatus === 'trial') {
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
    description = 'Your last payment failed. Please update your payment method.';
  } else if (info.subscriptionStatus === 'grace') {
    statusText = 'Grace period';
    statusTone = 'amber';
    statusIcon = Clock;
    description = 'Your payment is past due. Please update your payment method to avoid suspension.';
  } else if (info.subscriptionStatus === 'locked') {
    statusText = 'Account locked';
    statusTone = 'rose';
    statusIcon = Lock;
    description = 'Your account has been locked due to failed payments. Please contact support.';
  } else if (info.subscriptionStatus === 'cancelled') {
    statusText = 'Cancelled';
    statusTone = 'slate';
    statusIcon = XCircle;
    description = 'Your subscription has been cancelled.';
  }

  const stats: BillingHeroStat[] = [
    {
      label: 'Current plan',
      value: info.currentPlan.name,
      hint: info.planExpiresAt || info.currentPeriodEnd ? `Renews ${new Date(info.planExpiresAt || info.currentPeriodEnd || '').toLocaleDateString()}` : 'No expiry',
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
      className="relative overflow-hidden rounded-xl border border-sky-200/70 bg-[linear-gradient(100deg,#f0f9ff_0%,#f5fbff_42%,#ffffff_100%)] p-2.5 shadow-[0_8px_24px_rgba(2,132,199,0.05)] dark:border-sky-900/50 dark:bg-[linear-gradient(100deg,#0b1526_0%,#0f1d33_45%,#0b1424_100%)] sm:rounded-[22px] sm:p-5 md:p-6"
    >
      <div
        className="pointer-events-none absolute -left-20 -top-24 h-56 w-56 rounded-full bg-emerald-200/30 blur-3xl dark:bg-emerald-500/10 max-sm:hidden"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -right-12 -bottom-14 h-48 w-48 rounded-full bg-sky-200/20 blur-3xl dark:bg-sky-500/10 max-sm:hidden"
        aria-hidden="true"
      />

      <div className="relative flex flex-col gap-2.5 sm:gap-5 xl:flex-row xl:items-center xl:justify-between xl:gap-8">
        <div className="min-w-0 max-w-xl">
          <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-[0.1em] text-sky-700 ring-1 ring-sky-200/70 dark:bg-sky-950/40 dark:text-sky-300 dark:ring-sky-800/50 sm:gap-1.5 sm:px-2.5 sm:py-1 sm:text-[10px] sm:tracking-[0.12em]">
            <CreditCard className="h-2.5 w-2.5 sm:h-3 sm:w-3" strokeWidth={2.5} />
            Billing
          </span>
          <h1 className="mt-1.5 text-[1.05rem] font-extrabold leading-snug tracking-tight text-[#0f172a] dark:text-white sm:mt-3 sm:text-[1.5rem] md:text-[1.65rem] xl:whitespace-nowrap">
            {title}
          </h1>
          <p className="mt-0.5 hidden max-w-md text-[12px] font-medium leading-relaxed text-[#64748b] dark:text-slate-300 sm:mt-1.5 sm:block sm:text-[13px]">
            {description}
          </p>
        </div>

        <div className="grid w-full grid-cols-2 gap-1.5 sm:gap-2.5 md:grid-cols-3 xl:w-auto xl:min-w-0 xl:max-w-none xl:shrink-0">
          {stats.map((stat) => {
            const config = toneStyles[stat.tone] || toneStyles.emerald;
            const Icon = stat.icon || config.icon;
            return (
              <div
                key={stat.label}
                className="flex min-w-0 items-center gap-1.5 rounded-lg border border-neutral-200/80 bg-white px-2 py-1.5 shadow-[0_1px_2px_rgba(15,23,42,0.03)] dark:border-slate-700/70 dark:bg-slate-900/70 sm:gap-2.5 sm:rounded-2xl sm:px-3 sm:py-3 xl:w-[150px] 2xl:w-[160px]"
              >
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full sm:h-9 sm:w-9 ${config.chip}`}
                >
                  <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" strokeWidth={2.25} />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-[9px] font-semibold leading-tight text-neutral-800 dark:text-slate-200 sm:text-[12px]">
                    {stat.label}
                  </p>
                  <p
                    className={`mt-0.5 text-[1rem] font-extrabold leading-none tracking-tight tabular-nums sm:text-[1.35rem] ${config.valueClass}`}
                  >
                    {typeof stat.value === 'number' ? stat.value.toLocaleString() : stat.value}
                  </p>
                  <p className="mt-1 hidden truncate text-[11px] font-medium leading-snug text-neutral-400 dark:text-slate-400 sm:block">
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
