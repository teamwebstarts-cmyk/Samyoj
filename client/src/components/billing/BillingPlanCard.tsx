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
  bar: string;
  iconBg: string;
  glow: string;
  badge?: string;
  icon: LucideIcon;
  priceTone: string;
};

const planThemes: Record<string, PlanTheme> = {
  launch: {
    bar: 'from-slate-400 to-slate-600',
    iconBg: 'from-slate-50 to-slate-100 text-slate-700 dark:from-slate-900/40 dark:to-slate-800/30 dark:text-slate-300',
    glow: 'bg-slate-400/15',
    icon: Beaker,
    priceTone: 'text-slate-700 dark:text-slate-300',
    badge: 'Trial',
  },
  starter: {
    bar: 'from-emerald-400 to-whatsapp-600',
    iconBg: 'from-emerald-50 to-emerald-100 text-whatsapp-700 dark:from-emerald-900/40 dark:to-emerald-800/30 dark:text-emerald-300',
    glow: 'bg-emerald-400/15',
    icon: Sparkles,
    priceTone: 'text-emerald-700 dark:text-emerald-300',
  },
  growth: {
    bar: 'from-violet-400 to-purple-600',
    iconBg: 'from-violet-50 to-violet-100 text-violet-700 dark:from-violet-900/40 dark:to-violet-800/30 dark:text-violet-300',
    glow: 'bg-violet-400/20',
    icon: Zap,
    priceTone: 'text-violet-700 dark:text-violet-300',
  },
  pro: {
    bar: 'from-sky-400 to-blue-600',
    iconBg: 'from-sky-50 to-sky-100 text-sky-700 dark:from-sky-900/40 dark:to-sky-800/30 dark:text-sky-300',
    glow: 'bg-sky-400/15',
    icon: Crown,
    priceTone: 'text-sky-700 dark:text-sky-300',
  },
  enterprise: {
    bar: 'from-amber-400 to-orange-500',
    iconBg: 'from-amber-50 to-amber-100 text-amber-700 dark:from-amber-900/40 dark:to-amber-800/30 dark:text-amber-300',
    glow: 'bg-amber-400/15',
    icon: Building2,
    priceTone: 'text-amber-700 dark:text-amber-300',
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
      isUpiCapExceeded = true; // ₹28,320 incl GST > ₹15,000 RBI UPI Autopay limit
    }
  } else if (plan.id === 'pro') {
    if (cadence === 'quarterly') {
      displayPrice = '₹4,750/mo';
      billingSummary = 'Billed ₹14,250 quarterly (+ GST)';
      isUpiCapExceeded = true; // ₹16,815 incl GST > ₹15,000 RBI UPI Autopay limit
    } else if (cadence === 'yearly') {
      displayPrice = '₹4,000/mo';
      billingSummary = 'Billed ₹48,000 yearly (+ GST)';
      isUpiCapExceeded = true; // ₹56,640 incl GST > ₹15,000 RBI UPI Autopay limit
    }
  }

  return (
    <div
      className={`dashboard-card group relative h-full w-full flex flex-col overflow-hidden animate-fade-up ${
        isCurrent
          ? 'ring-2 ring-emerald-500/50 shadow-[0_8px_30px_rgba(16,185,129,0.12)]'
          : plan.isMostPopular
            ? 'ring-1 ring-violet-200/80 dark:ring-violet-800/40'
            : ''
      }`}
    >
      <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${theme.bar}`} />
      <div
        className={`pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full blur-2xl ${theme.glow} opacity-70`}
      />

      {isCurrent && (
        <div className="absolute right-4 top-4 rounded-full bg-emerald-500 px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white shadow-sm">
          Active
        </div>
      )}

      {!isCurrent && showBadge && (
        <div className={`absolute right-4 top-4 rounded-full px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white shadow-sm ${plan.isMostPopular ? 'bg-violet-600' : 'bg-slate-600'}`}>
          {badgeText}
        </div>
      )}

      <div className="relative flex flex-1 flex-col p-5 pt-6">
        <div className="flex items-start gap-3">
          <div
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${theme.iconBg}`}
          >
            <Icon className="h-5 w-5" strokeWidth={2.25} />
          </div>
          <div className="min-w-0 pt-0.5">
            <h3 className="text-[16px] font-extrabold tracking-tight text-theme-fg">{plan.name}</h3>
            <p className="mt-0.5 text-[11px] font-semibold text-theme-muted">
              {plan.waNumbers} WhatsApp numbers · {plan.seats} seats · {plan.contacts} contacts
            </p>
          </div>
        </div>

        <div className="mt-5">
          {!isEnterprise ? (
            <div>
              <div className="flex items-baseline gap-1">
                <p className={`text-[2rem] font-extrabold leading-none tracking-tight ${theme.priceTone}`}>
                  {displayPrice}
                </p>
                <span className="text-xs font-semibold text-theme-muted">+ GST</span>
              </div>
              <p className="mt-1.5 text-[11px] font-medium text-theme-muted">{billingSummary}</p>
              {isUpiCapExceeded && (
                <p className="mt-1 text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                  Card / NetBanking required (exceeds ₹15k UPI Autopay limit)
                </p>
              )}
            </div>
          ) : (
            <div>
              <p className={`text-[2rem] font-extrabold leading-none tracking-tight ${theme.priceTone}`}>
                Custom
              </p>
              <p className="mt-1.5 text-[11px] font-medium text-theme-muted">Tailored for large scale</p>
            </div>
          )}
        </div>

        <ul className="mt-6 flex-1 space-y-2.5">
          {plan.features.map((feature) => (
            <li key={feature} className="flex items-start gap-2.5 text-[12px] text-theme-secondary">
              <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                <Check className="h-2.5 w-2.5" strokeWidth={3} />
              </span>
              <span className="font-medium leading-snug">{feature}</span>
            </li>
          ))}
        </ul>

        <AppButton
          className="mt-6"
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
