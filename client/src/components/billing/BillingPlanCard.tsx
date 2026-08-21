import { Check, Crown, Sparkles, Zap, Building2, Beaker } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import AppButton from '../ui/AppButton';
import type { BillingPlan } from '../../types';

interface BillingPlanCardProps {
  plan: BillingPlan;
  isCurrent: boolean;
  canManage: boolean;
  razorpayConfigured: boolean;
  loading: boolean;
  onSelect: () => void;
  cadence?: 'monthly' | 'quarterly' | 'yearly';
}

type PlanTheme = {
  iconBg: string;
  accent: string;
  badge?: string;
  icon: LucideIcon;
  priceTone: string;
  ring: string;
};

const planThemes: Record<string, PlanTheme> = {
  launch: {
    iconBg: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
    accent: 'text-slate-600 dark:text-slate-400',
    icon: Beaker,
    priceTone: 'text-slate-800 dark:text-slate-200',
    ring: 'ring-slate-200 dark:ring-slate-700',
    badge: 'Trial',
  },
  starter: {
    iconBg: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400',
    accent: 'text-emerald-600 dark:text-emerald-400',
    icon: Sparkles,
    priceTone: 'text-emerald-700 dark:text-emerald-300',
    ring: 'ring-emerald-200 dark:ring-emerald-800/50',
  },
  growth: {
    iconBg: 'bg-violet-50 text-violet-600 dark:bg-violet-950/50 dark:text-violet-400',
    accent: 'text-violet-600 dark:text-violet-400',
    icon: Zap,
    priceTone: 'text-violet-700 dark:text-violet-300',
    ring: 'ring-violet-200 dark:ring-violet-800/50',
  },
  pro: {
    iconBg: 'bg-sky-50 text-sky-600 dark:bg-sky-950/50 dark:text-sky-400',
    accent: 'text-sky-600 dark:text-sky-400',
    icon: Crown,
    priceTone: 'text-sky-700 dark:text-sky-300',
    ring: 'ring-sky-200 dark:ring-sky-800/50',
  },
  enterprise: {
    iconBg: 'bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400',
    accent: 'text-amber-600 dark:text-amber-400',
    icon: Building2,
    priceTone: 'text-amber-700 dark:text-amber-300',
    ring: 'ring-amber-200 dark:ring-amber-800/50',
  },
};

export default function BillingPlanCard({
  plan,
  isCurrent,
  canManage,
  razorpayConfigured,
  loading,
  onSelect,
  cadence = 'monthly',
}: BillingPlanCardProps) {
  const theme = planThemes[plan.id] ?? planThemes.starter;
  const Icon = theme.icon;
  const isPaid = plan.pricePaise > 0;
  const isEnterprise = plan.id === 'enterprise';

  const buttonLabel = isCurrent
    ? 'Current plan'
    : isEnterprise
      ? 'Talk to experts'
      : isPaid
        ? 'Upgrade'
        : 'Switch plan';

  const showBadge = theme.badge || plan.isMostPopular;
  const badgeText = plan.isMostPopular ? 'Most popular' : theme.badge;

  // Dynamic cadence pricing calculation from catalog
  let displayPrice = plan.priceLabel;
  let billingSummary = `Billed ${cadence} · cancel anytime`;
  let isUpiCapExceeded = false;

  if (plan.id === 'starter') {
    if (cadence === 'quarterly') {
      displayPrice = '₹950/mo';
      billingSummary = 'Billed ₹2,850 quarterly (+ GST)';
    } else if (cadence === 'yearly') {
      displayPrice = '₹800/mo';
      billingSummary = 'Billed ₹9,600 yearly (+ GST)';
    }
  } else if (plan.id === 'growth') {
    if (cadence === 'quarterly') {
      displayPrice = '₹2,375/mo';
      billingSummary = 'Billed ₹7,125 quarterly (+ GST)';
    } else if (cadence === 'yearly') {
      displayPrice = '₹2,000/mo';
      billingSummary = 'Billed ₹24,000 yearly (+ GST)';
      isUpiCapExceeded = true;
    }
  } else if (plan.id === 'pro') {
    if (cadence === 'quarterly') {
      displayPrice = '₹4,750/mo';
      billingSummary = 'Billed ₹14,250 quarterly (+ GST)';
      isUpiCapExceeded = true;
    } else if (cadence === 'yearly') {
      displayPrice = '₹4,000/mo';
      billingSummary = 'Billed ₹48,000 yearly (+ GST)';
      isUpiCapExceeded = true;
    }
  }

  return (
    <div
      className={`group relative flex h-full w-full flex-col rounded-2xl border bg-theme-surface transition-shadow duration-200 hover:shadow-lg ${
        isCurrent
          ? `border-emerald-300 shadow-[0_4px_20px_rgba(16,185,129,0.1)] dark:border-emerald-700/60`
          : plan.isMostPopular
            ? `border-violet-200 dark:border-violet-800/50`
            : `border-theme-border ${theme.ring}`
      }`}
    >
      {/* Badges */}
      {isCurrent && (
        <div className="absolute right-4 top-4 rounded-full bg-emerald-500 px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white shadow-sm">
          Active
        </div>
      )}
      {!isCurrent && showBadge && (
        <div className={`absolute right-4 top-4 rounded-full px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white shadow-sm ${plan.isMostPopular ? 'bg-violet-600' : 'bg-slate-500'}`}>
          {badgeText}
        </div>
      )}

      <div className="relative flex flex-1 flex-col p-5">
        {/* Icon + Name */}
        <div className="flex items-center gap-3">
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${theme.iconBg}`}>
            <Icon className="h-5 w-5" strokeWidth={2.25} />
          </div>
          <div className="min-w-0">
            <h3 className="text-[15px] font-extrabold tracking-tight text-theme-fg">{plan.name}</h3>
          </div>
        </div>

        {/* Summary line */}
        <p className="mt-2 text-[11px] font-medium text-theme-muted">
          {plan.waNumbers} WhatsApp numbers · {plan.seats} seats · {plan.contacts} contacts
        </p>

        {/* Price */}
        <div className="mt-4">
          {!isEnterprise ? (
            <div>
              <div className="flex items-baseline gap-1">
                <p className={`text-[1.75rem] font-extrabold leading-none tracking-tight ${theme.priceTone}`}>
                  {displayPrice}
                </p>
                <span className="text-[11px] font-semibold text-theme-muted">+ GST</span>
              </div>
              <p className="mt-1 text-[11px] font-medium text-theme-muted">{billingSummary}</p>
              {isUpiCapExceeded && (
                <p className="mt-1 text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                  Card / NetBanking required (exceeds ₹15k UPI Autopay limit)
                </p>
              )}
            </div>
          ) : (
            <div>
              <p className={`text-[1.75rem] font-extrabold leading-none tracking-tight ${theme.priceTone}`}>
                Custom
              </p>
              <p className="mt-1 text-[11px] font-medium text-theme-muted">Tailored for large scale</p>
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="my-4 h-px bg-theme-border" />

        {/* Features */}
        <ul className="flex-1 space-y-2">
          {plan.features.map((feature) => (
            <li key={feature} className="flex items-start gap-2 text-[12px] text-theme-secondary">
              <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${theme.iconBg}`}>
                <Check className="h-2.5 w-2.5" strokeWidth={3} />
              </span>
              <span className="font-medium leading-snug">{feature}</span>
            </li>
          ))}
        </ul>

        {/* CTA */}
        <AppButton
          className="mt-5"
          variant={isCurrent ? 'secondary' : 'primary'}
          fullWidth
          disabled={isCurrent || !canManage || (isPaid && !razorpayConfigured && !isEnterprise)}
          loading={loading}
          onClick={onSelect}
        >
          {buttonLabel}
        </AppButton>
      </div>
    </div>
  );
}
