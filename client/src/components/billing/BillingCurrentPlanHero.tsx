import {
  AlertCircle,
  Bot,
  CalendarDays,
  CheckCircle2,
  Clock,
  Crown,
  Layers,
  MessageSquare,
  PhoneCall,
  Sparkles,
  Users,
} from 'lucide-react';
import ProgressBar from '../ui/ProgressBar';
import AppButton from '../ui/AppButton';
import type { BillingInfo } from '../../types';

interface BillingCurrentPlanHeroProps {
  info: BillingInfo;
  onUnlockGrowth?: () => void;
}

const tierColors: Record<string, string> = {
  launch: 'bg-slate-100 text-slate-700 ring-slate-200 dark:bg-slate-900/60 dark:text-slate-300 dark:ring-slate-700/60',
  starter: 'bg-emerald-100 text-emerald-700 ring-emerald-200 dark:bg-emerald-900/60 dark:text-emerald-300 dark:ring-emerald-700/60',
  growth: 'bg-violet-100 text-violet-700 ring-violet-200 dark:bg-violet-900/60 dark:text-violet-300 dark:ring-violet-700/60',
  pro: 'bg-sky-100 text-sky-700 ring-sky-200 dark:bg-sky-900/60 dark:text-sky-300 dark:ring-sky-700/60',
  enterprise: 'bg-amber-100 text-amber-700 ring-amber-200 dark:bg-amber-900/60 dark:text-amber-300 dark:ring-amber-700/60',
};

function getStatusBadge(status?: string | null) {
  if (status === 'trial') return { text: 'Trial', classes: 'bg-amber-100 text-amber-700 ring-amber-200 dark:bg-amber-900/60 dark:text-amber-300 dark:ring-amber-700/60', icon: Clock };
  if (status === 'trial_expired') return { text: 'Trial Expired', classes: 'bg-rose-100 text-rose-700 ring-rose-200 dark:bg-rose-900/60 dark:text-rose-300 dark:ring-rose-700/60', icon: AlertCircle };
  if (status === 'past_due' || status === 'grace' || status === 'locked') return { text: 'Payment Issue', classes: 'bg-rose-100 text-rose-700 ring-rose-200 dark:bg-rose-900/60 dark:text-rose-300 dark:ring-rose-700/60', icon: AlertCircle };
  if (status === 'cancelled') return { text: 'Cancelled', classes: 'bg-slate-100 text-slate-700 ring-slate-200 dark:bg-slate-900/60 dark:text-slate-300 dark:ring-slate-700/60', icon: AlertCircle };
  return { text: 'Active', classes: 'bg-emerald-100 text-emerald-700 ring-emerald-200 dark:bg-emerald-900/60 dark:text-emerald-300 dark:ring-emerald-700/60', icon: CheckCircle2 };
}

export default function BillingCurrentPlanHero({ info, onUnlockGrowth }: BillingCurrentPlanHeroProps) {
  const seatPct = info.seatLimit > 0 ? Math.min(100, Math.round((info.seatsUsed / info.seatLimit) * 100)) : 0;
  const seatsNearLimit = seatPct >= 85;

  const status = getStatusBadge(info.subscriptionStatus);
  const StatusIcon = status.icon;

  const isBasePlan = info.plan === 'launch' || info.plan === 'starter';
  const plan = info.currentPlan;

  // AI status description
  const hasAi = plan.aiIncluded && plan.aiIncluded !== 'off';
  const hasCalling = plan.callingIncluded;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-neutral-200/80 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-4 max-w-2xl">
          <div className="flex flex-wrap items-center gap-2.5">
            <h2 className="text-xl font-extrabold tracking-tight text-neutral-900 dark:text-white sm:text-2xl">
              {plan.name} Plan
            </h2>
            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-extrabold ring-1 ring-inset ${tierColors[info.plan] || tierColors.launch}`}>
              {info.plan.toUpperCase()}
            </span>
            <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${status.classes}`}>
              <StatusIcon className="h-3.5 w-3.5" />
              {status.text}
            </span>
            {info.cadence && info.cadence !== 'trial' && (
              <span className="inline-flex items-center rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-semibold text-neutral-700 ring-1 ring-inset ring-neutral-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700">
                {info.cadence.charAt(0).toUpperCase() + info.cadence.slice(1)} Billing
              </span>
            )}
          </div>

          <div className="space-y-1">
            {(info.currentPeriodEnd || info.planExpiresAt) && (
              <p className="flex items-center gap-1.5 text-sm font-medium text-neutral-600 dark:text-slate-300">
                <CalendarDays className="h-4 w-4 text-neutral-400" />
                {info.subscriptionStatus === 'trial' ? 'Trial ends' : 'Renews'}{' '}
                <strong className="font-semibold text-neutral-900 dark:text-white">
                  {new Date(info.currentPeriodEnd || info.planExpiresAt || '').toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </strong>
              </p>
            )}

            {info.subscriptionStatus === 'trial' && info.trialEndsAt && (
              <p className="flex items-center gap-1.5 text-sm font-semibold text-amber-600 dark:text-amber-400">
                <Clock className="h-4 w-4" />
                {Math.max(0, Math.ceil((new Date(info.trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))} days left in trial
              </p>
            )}
          </div>

          {/* Key Entitlements Matrix Chips */}
          <div className="grid grid-cols-2 gap-2 pt-2 sm:grid-cols-4">
            <div className="rounded-xl border border-neutral-100 bg-neutral-50/75 p-2.5 dark:border-slate-800 dark:bg-slate-950/40">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-neutral-500 dark:text-slate-400">
                <MessageSquare className="h-3.5 w-3.5 text-sky-600" />
                <span>WhatsApp Slots</span>
              </div>
              <p className="mt-1 text-sm font-extrabold text-neutral-900 dark:text-white">
                {plan.waNumbers} {typeof plan.waNumbers === 'number' && plan.waNumbers > 1 ? 'Numbers' : 'Number'}
              </p>
            </div>

            <div className="rounded-xl border border-neutral-100 bg-neutral-50/75 p-2.5 dark:border-slate-800 dark:bg-slate-950/40">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-neutral-500 dark:text-slate-400">
                <Layers className="h-3.5 w-3.5 text-indigo-600" />
                <span>Contact Quota</span>
              </div>
              <p className="mt-1 text-sm font-extrabold text-neutral-900 dark:text-white">
                {typeof plan.contacts === 'number' ? plan.contacts.toLocaleString() : plan.contacts}
              </p>
            </div>

            <div className="rounded-xl border border-neutral-100 bg-neutral-50/75 p-2.5 dark:border-slate-800 dark:bg-slate-950/40">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-neutral-500 dark:text-slate-400">
                <Bot className="h-3.5 w-3.5 text-violet-600" />
                <span>AI Chatbot</span>
              </div>
              <p className="mt-1 text-sm font-extrabold text-neutral-900 dark:text-white">
                {hasAi ? (plan.aiIncluded === 'advanced' ? 'Advanced' : 'Included') : 'Not Included'}
              </p>
            </div>

            <div className="rounded-xl border border-neutral-100 bg-neutral-50/75 p-2.5 dark:border-slate-800 dark:bg-slate-950/40">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-neutral-500 dark:text-slate-400">
                <PhoneCall className="h-3.5 w-3.5 text-emerald-600" />
                <span>AI Voice Calling</span>
              </div>
              <p className="mt-1 text-sm font-extrabold text-neutral-900 dark:text-white">
                {hasCalling ? 'Included' : 'Pro Tier Only'}
              </p>
            </div>
          </div>
        </div>

        {/* CTA Column */}
        <div className="flex flex-col items-start gap-2.5 shrink-0 sm:items-end">
          {isBasePlan ? (
            <AppButton
              variant="primary"
              className="!bg-violet-600 hover:!bg-violet-700 shadow-md shadow-violet-500/20 text-white"
              icon={<Crown size={16} />}
              onClick={onUnlockGrowth}
            >
              Unlock Growth
            </AppButton>
          ) : (
            <AppButton
              variant="secondary"
              icon={<Sparkles size={16} />}
              onClick={onUnlockGrowth}
            >
              View Plan Options
            </AppButton>
          )}
          <span className="text-[11px] text-neutral-400 dark:text-slate-500">
            Cancel or switch anytime
          </span>
        </div>
      </div>

      {/* Seat Meter Section */}
      <div className="mt-6 max-w-2xl border-t border-neutral-100 pt-6 dark:border-slate-800/60">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-sky-600" />
            <span className="text-sm font-semibold text-neutral-900 dark:text-white">
              Team Member Seats
            </span>
          </div>
          <span className="text-sm font-bold tabular-nums text-neutral-600 dark:text-slate-300">
            {info.seatsUsed} <span className="font-medium text-neutral-400">/ {info.seatLimit}</span>
          </span>
        </div>
        <ProgressBar value={info.seatsUsed} max={info.seatLimit} />
        <p
          className={`mt-2 text-xs ${
            seatsNearLimit ? 'font-semibold text-amber-600 dark:text-amber-400' : 'text-neutral-500 dark:text-slate-400'
          }`}
        >
          {seatsNearLimit
            ? '⚠️ You are near your seat limit. Upgrade to add more team members.'
            : `${Math.max(0, info.seatLimit - info.seatsUsed)} seats available for new team members.`}
        </p>
      </div>
    </div>
  );
}

