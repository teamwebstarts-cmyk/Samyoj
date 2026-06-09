import { CalendarDays, CreditCard, ShieldCheck, Users } from 'lucide-react';
import type { BillingInfo } from '../../types';

interface BillingCurrentPlanHeroProps {
  info: BillingInfo;
}

function formatStatus(status?: string | null) {
  if (!status) return 'Active';
  return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
}

export default function BillingCurrentPlanHero({ info }: BillingCurrentPlanHeroProps) {
  const seatPct =
    info.seatLimit > 0 ? Math.min(100, Math.round((info.seatsUsed / info.seatLimit) * 100)) : 0;
  const seatsNearLimit = seatPct >= 85;
  const barColor = seatsNearLimit
    ? 'from-amber-400 to-orange-500'
    : 'from-emerald-400 to-whatsapp-600';

  return (
    <div className="dashboard-hero relative overflow-hidden rounded-2xl p-5 sm:p-6 lg:p-7 animate-fade-up">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(37,211,102,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(37,211,102,0.04)_1px,transparent_1px)] bg-[size:48px_48px]" />
      <div className="pointer-events-none absolute -left-16 top-0 h-48 w-48 rounded-full bg-whatsapp-500/10 blur-[80px]" />
      <div className="pointer-events-none absolute -right-10 bottom-0 h-40 w-40 rounded-full bg-emerald-300/15 blur-[70px]" />

      <div className="relative">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200/80 bg-theme-surface/80 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-whatsapp-700 shadow-sm backdrop-blur-sm dark:text-whatsapp-400">
            <CreditCard className="h-3 w-3" />
            Your subscription
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-100 bg-emerald-50/90 px-2.5 py-1 text-[10px] font-semibold text-emerald-800 dark:border-emerald-800/40 dark:bg-emerald-900/30 dark:text-emerald-300">
            <ShieldCheck className="h-3 w-3" />
            {formatStatus(info.subscriptionStatus)}
          </span>
        </div>

        <div className="mt-5 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold text-theme-secondary">Current plan</p>
            <p className="mt-1 bg-gradient-to-br from-neutral-900 via-emerald-900 to-whatsapp-700 bg-clip-text text-[2.25rem] font-extrabold leading-none tracking-tight text-transparent sm:text-4xl dark:from-white dark:via-emerald-200 dark:to-whatsapp-300">
              {info.currentPlan.name}
            </p>
            <p className="mt-2 text-[15px] font-bold text-theme-fg">{info.currentPlan.priceLabel}</p>
            {info.planExpiresAt && (
              <p className="mt-2 inline-flex items-center gap-1.5 text-[12px] font-medium text-amber-700 dark:text-amber-300">
                <CalendarDays className="h-3.5 w-3.5" />
                Renews {new Date(info.planExpiresAt).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </p>
            )}
          </div>

          <div className="w-full max-w-sm rounded-2xl border border-emerald-100/90 bg-theme-surface/85 p-4 shadow-sm backdrop-blur-sm dark:border-emerald-800/30">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-50 to-emerald-100 text-whatsapp-700 dark:from-emerald-900/40 dark:to-emerald-800/30 dark:text-emerald-300">
                  <Users className="h-4 w-4" strokeWidth={2.25} />
                </div>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wide text-theme-muted">
                    Team seats
                  </p>
                  <p className="text-lg font-extrabold tabular-nums text-theme-fg">
                    {info.seatsUsed}
                    <span className="text-base font-bold text-theme-muted"> / {info.seatLimit}</span>
                  </p>
                </div>
              </div>
              <span
                className={`rounded-lg px-2 py-1 text-[11px] font-bold tabular-nums ${
                  seatsNearLimit
                    ? 'bg-amber-50 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
                    : 'bg-emerald-50 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300'
                }`}
              >
                {seatPct}%
              </span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-theme-subtle ring-1 ring-theme-border/60">
              <div
                className={`h-full rounded-full bg-gradient-to-r transition-all duration-700 ${barColor}`}
                style={{ width: `${seatPct}%` }}
              />
            </div>
            <p className="mt-2 text-[11px] font-medium text-theme-muted">
              {seatsNearLimit
                ? 'You are nearing your seat limit — consider upgrading.'
                : `${info.seatLimit - info.seatsUsed} seats available for new members`}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
