import { Check, Crown, Sparkles, Zap, Building2, Rocket } from 'lucide-react';
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
  isActivePaidSession?: boolean;
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
    iconBg:
      'bg-gradient-to-br from-emerald-50 to-sky-50 text-emerald-600 shadow-sm ring-1 ring-emerald-100/80 dark:from-emerald-950/50 dark:to-sky-950/40 dark:text-emerald-300 dark:ring-emerald-800/40',
    accent: 'text-emerald-600 dark:text-emerald-400',
    icon: Rocket,
    priceTone: 'text-emerald-700 dark:text-emerald-300',
    ring: 'ring-emerald-200 dark:ring-emerald-800/50',
    badge: '14 days free',
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
  isActivePaidSession,
}: BillingPlanCardProps) {
  const theme = planThemes[plan.id] ?? planThemes.starter;
  const Icon = theme.icon;
  const isPaid = plan.pricePaise > 0 || Boolean(plan.pricing?.monthly);
  const isEnterprise = plan.id === 'enterprise';

  const sku = plan.pricing?.[cadence];
  const displayPrice = sku?.effectiveMonthlyLabel ?? plan.priceLabel;
  const billingSummary = sku?.billingLabel ?? `Billed ${cadence} · cancel anytime`;
  const isUpiCapExceeded = sku ? !sku.upiAutopayAllowed : false;

  const buttonLabel = isCurrent
    ? 'Current plan'
    : isActivePaidSession
      ? 'Restore Plan'
      : isEnterprise
        ? 'Contact sales'
        : isPaid
          ? 'Upgrade'
          : plan.id === 'launch'
            ? 'Start free trial'
            : 'Switch plan';

  const showStatusBadge =
    isCurrent || isActivePaidSession || plan.isMostPopular || Boolean(theme.badge);
  const statusBadgeText = isCurrent
    ? 'Active'
    : isActivePaidSession
      ? 'Purchased'
      : plan.isMostPopular
        ? 'Most popular'
        : theme.badge;

  const statusBadgeClass = isCurrent
    ? 'bg-emerald-500 text-white'
    : isActivePaidSession
      ? 'bg-emerald-600 text-white'
      : plan.isMostPopular
        ? 'bg-violet-600 text-white'
        : 'bg-slate-500 text-white';

  return (
    <div
      className={`relative flex h-full w-full flex-col justify-between rounded-2xl border bg-theme-surface p-4 sm:p-5 transition-colors ${
        isCurrent
          ? 'border-emerald-500/80 ring-1 ring-emerald-500/30'
          : isActivePaidSession
            ? 'border-emerald-400 dark:border-emerald-700'
            : 'border-theme-border'
      }`}
    >
      <div className="flex flex-1 flex-col">
        <div className="flex items-start gap-2.5">
          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${theme.iconBg}`}>
            <Icon className="h-4.5 w-4.5" strokeWidth={2.25} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <h3 className="text-base font-extrabold tracking-tight text-theme-fg">{plan.name}</h3>
              {showStatusBadge ? (
                <span
                  className={`shrink-0 rounded-md px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${statusBadgeClass}`}
                >
                  {statusBadgeText}
                </span>
              ) : null}
            </div>
          </div>
        </div>

        <p className="mt-2.5 text-[11px] font-medium text-theme-muted">
          {plan.waNumbers} WA line · {plan.seats} seats · {typeof plan.contacts === 'number' ? plan.contacts.toLocaleString() : plan.contacts} contacts
          {(plan.chatCreditsIncluded ?? 0) > 0
            ? ` · ${plan.chatCreditsIncluded!.toLocaleString()} AI credits/mo`
            : plan.aiIncluded === 'off'
              ? ' · Upgrade for AI credits'
              : ''}
          {(plan.callingMinutesIncluded ?? 0) > 0
            ? ` · ${plan.callingMinutesIncluded} calling min/mo`
            : ''}
        </p>

        <div className="mt-3.5 min-h-[58px]">
          {!isEnterprise ? (
            <div>
              <div className="flex flex-wrap items-baseline gap-1">
                <p className={`text-2xl font-black leading-none tracking-tight sm:text-[1.65rem] ${theme.priceTone}`}>
                  {displayPrice}
                </p>
                {sku && (
                  <span className="text-[10.5px] font-semibold text-theme-muted">incl. GST</span>
                )}
              </div>
              <p className="mt-1 text-[10.5px] font-medium text-theme-muted">{billingSummary}</p>
              {isUpiCapExceeded && (
                <p className="mt-0.5 text-[9.5px] font-semibold text-amber-600 dark:text-amber-400">
                  Card / NetBanking required (&gt;₹15k UPI limit)
                </p>
              )}
            </div>
          ) : (
            <div>
              <p className={`text-2xl font-black leading-none tracking-tight sm:text-[1.65rem] ${theme.priceTone}`}>
                Custom
              </p>
              <p className="mt-1 text-[10.5px] font-medium text-theme-muted">Tailored for enterprise scale</p>
            </div>
          )}
        </div>

        <div className="my-3.5 h-px bg-theme-border" />

        <ul className="flex-1 space-y-2">
          {plan.features.map((feature) => (
            <li key={feature} className="flex items-start gap-2 text-[11.5px] text-theme-secondary">
              <span className={`mt-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full ${theme.iconBg}`}>
                <Check className="h-2 w-2" strokeWidth={3} />
              </span>
              <span className="font-medium leading-snug">{feature}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-4 pt-2">
        <AppButton
          size="sm"
          variant={isCurrent ? 'secondary' : 'primary'}
          className={isActivePaidSession ? '!bg-emerald-600 hover:!bg-emerald-700 text-white' : ''}
          fullWidth
          disabled={isCurrent || !canManage || (isPaid && !razorpayConfigured && !isEnterprise && !isActivePaidSession)}
          loading={loading}
          onClick={onSelect}
        >
          {buttonLabel}
        </AppButton>
      </div>
    </div>
  );
}
