import {
  AlertCircle,
  Bot,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock,
  Crown,
  MessageSquare,
  PhoneCall,
  Sparkles,
  Users,
  X,
} from 'lucide-react';
import ProgressBar from '../ui/ProgressBar';
import AppButton from '../ui/AppButton';
import type { BillingInfo } from '../../types';

interface BillingCurrentPlanHeroProps {
  info: BillingInfo;
  onUnlockGrowth?: () => void;
}

const tierAccents: Record<string, { bg: string; text: string; ring: string; icon: string }> = {
  launch: {
    bg: 'bg-slate-50 dark:bg-slate-900/40',
    text: 'text-slate-700 dark:text-slate-300',
    ring: 'ring-slate-200 dark:ring-slate-700',
    icon: 'text-slate-500',
  },
  starter: {
    bg: 'bg-emerald-50 dark:bg-emerald-950/40',
    text: 'text-emerald-700 dark:text-emerald-300',
    ring: 'ring-emerald-200 dark:ring-emerald-800',
    icon: 'text-emerald-500',
  },
  growth: {
    bg: 'bg-violet-50 dark:bg-violet-950/40',
    text: 'text-violet-700 dark:text-violet-300',
    ring: 'ring-violet-200 dark:ring-violet-800',
    icon: 'text-violet-500',
  },
  pro: {
    bg: 'bg-sky-50 dark:bg-sky-950/40',
    text: 'text-sky-700 dark:text-sky-300',
    ring: 'ring-sky-200 dark:ring-sky-800',
    icon: 'text-sky-500',
  },
  enterprise: {
    bg: 'bg-amber-50 dark:bg-amber-950/40',
    text: 'text-amber-700 dark:text-amber-300',
    ring: 'ring-amber-200 dark:ring-amber-800',
    icon: 'text-amber-500',
  },
};

function getStatusInfo(status?: string | null) {
  if (status === 'trial') return { text: 'Trial', color: 'text-amber-700 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-950/40', icon: Clock };
  if (status === 'trial_expired') return { text: 'Trial Expired', color: 'text-rose-700 dark:text-rose-400', bg: 'bg-rose-50 dark:bg-rose-950/40', icon: AlertCircle };
  if (status === 'past_due' || status === 'grace' || status === 'locked') return { text: 'Payment Issue', color: 'text-rose-700 dark:text-rose-400', bg: 'bg-rose-50 dark:bg-rose-950/40', icon: AlertCircle };
  if (status === 'cancelled') return { text: 'Cancelled', color: 'text-slate-600 dark:text-slate-400', bg: 'bg-slate-50 dark:bg-slate-900/40', icon: AlertCircle };
  return { text: 'Active', color: 'text-emerald-700 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/40', icon: CheckCircle2 };
}

export default function BillingCurrentPlanHero({ info, onUnlockGrowth }: BillingCurrentPlanHeroProps) {
  const seatPct = info.seatLimit > 0 ? Math.min(100, Math.round((info.seatsUsed / info.seatLimit) * 100)) : 0;
  const seatsNearLimit = seatPct >= 85;

  const status = getStatusInfo(info.subscriptionStatus);
  const StatusIcon = status.icon;
  const accent = tierAccents[info.plan] || tierAccents.launch;

  const isBasePlan = info.plan === 'launch' || info.plan === 'starter';
  const plan = info.currentPlan;

  const hasAi = plan.aiIncluded && plan.aiIncluded !== 'off';
  const hasCalling = plan.callingIncluded;

  const expiryDate = info.currentPeriodEnd || info.planExpiresAt;
  const daysLeft = info.trialEndsAt
    ? Math.max(0, Math.ceil((new Date(info.trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null;

  const entitlements = [
    {
      icon: MessageSquare,
      label: 'WhatsApp Numbers',
      value: `${plan.waNumbers}`,
      included: true,
      color: 'text-sky-600 dark:text-sky-400',
    },
    {
      icon: Users,
      label: 'Team Seats',
      value: `${plan.seats}`,
      included: true,
      color: 'text-indigo-600 dark:text-indigo-400',
    },
    {
      icon: Users,
      label: 'Contacts',
      value: typeof plan.contacts === 'number' ? plan.contacts.toLocaleString() : String(plan.contacts),
      included: true,
      color: 'text-violet-600 dark:text-violet-400',
    },
    {
      icon: Bot,
      label: 'AI Chatbot',
      value: hasAi ? (plan.aiIncluded === 'advanced' ? 'Advanced' : 'Included') : 'Not included',
      included: hasAi,
      color: 'text-purple-600 dark:text-purple-400',
    },
    {
      icon: PhoneCall,
      label: 'AI Voice Calling',
      value: hasCalling ? 'Included' : 'Pro only',
      included: hasCalling,
      color: 'text-emerald-600 dark:text-emerald-400',
    },
  ];

  return (
    <div className="relative overflow-hidden rounded-2xl border border-theme-border bg-theme-surface">
      {/* Top accent strip */}
      <div className={`h-1 w-full ${accent.bg}`} />

      <div className="p-5 sm:p-6">
        {/* Header row */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-3">
            {/* Plan name + badges */}
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-extrabold tracking-tight text-theme-fg sm:text-xl">
                {plan.name}
              </h2>
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ring-1 ring-inset ${accent.bg} ${accent.text} ${accent.ring}`}>
                {info.plan}
              </span>
              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ring-inset ${status.bg} ${status.color} ring-transparent`}>
                <StatusIcon className="h-3 w-3" />
                {status.text}
              </span>
              {info.cadence && info.cadence !== 'trial' && (
                <span className="text-[11px] font-medium text-theme-muted">
                  {info.cadence.charAt(0).toUpperCase() + info.cadence.slice(1)} billing
                </span>
              )}
            </div>

            {/* Date line */}
            {(expiryDate || daysLeft != null) && (
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
                  <span className="inline-flex items-center gap-1 font-semibold text-amber-600 dark:text-amber-400">
                    <Clock className="h-3.5 w-3.5" />
                    {daysLeft} days left
                  </span>
                )}
              </div>
            )}
          </div>

          {/* CTA */}
          <div className="flex shrink-0 flex-col items-start gap-1.5 sm:items-end">
            {isBasePlan ? (
              <AppButton
                variant="primary"
                className="!bg-violet-600 hover:!bg-violet-700 shadow-md shadow-violet-500/20 text-white"
                icon={<Crown size={15} />}
                onClick={onUnlockGrowth}
              >
                Unlock Growth
              </AppButton>
            ) : (
              <AppButton
                variant="secondary"
                icon={<Sparkles size={15} />}
                onClick={onUnlockGrowth}
              >
                View Plans
              </AppButton>
            )}
            <span className="text-[10px] text-theme-muted">
              Cancel or switch anytime
            </span>
          </div>
        </div>

        {/* Entitlements grid */}
        <div className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
          {entitlements.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.label}
                className="flex items-center gap-2.5 rounded-xl border border-theme-border/60 bg-theme-subtle/40 px-3 py-2.5"
              >
                <Icon className={`h-4 w-4 shrink-0 ${item.color}`} strokeWidth={2} />
                <div className="min-w-0">
                  <p className="text-[10px] font-medium text-theme-muted truncate">{item.label}</p>
                  <p className="flex items-center gap-1 text-[12px] font-bold text-theme-fg">
                    {item.included ? (
                      <Check className="h-3 w-3 shrink-0 text-emerald-500" strokeWidth={3} />
                    ) : (
                      <X className="h-3 w-3 shrink-0 text-theme-muted/50" strokeWidth={2.5} />
                    )}
                    {item.value}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Seat usage */}
        <div className="mt-5 rounded-xl border border-theme-border/60 bg-theme-subtle/30 px-4 py-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[12px] font-semibold text-theme-fg">
              Team seats
            </span>
            <span className="text-[12px] font-bold tabular-nums text-theme-fg">
              {info.seatsUsed}
              <span className="font-medium text-theme-muted"> / {info.seatLimit}</span>
            </span>
          </div>
          <ProgressBar value={info.seatsUsed} max={info.seatLimit} />
          <p className={`mt-1.5 text-[11px] ${seatsNearLimit ? 'font-semibold text-amber-600 dark:text-amber-400' : 'text-theme-muted'}`}>
            {seatsNearLimit
              ? 'Near seat limit — upgrade to add more team members'
              : `${Math.max(0, info.seatLimit - info.seatsUsed)} seats available`}
          </p>
        </div>
      </div>
    </div>
  );
}
