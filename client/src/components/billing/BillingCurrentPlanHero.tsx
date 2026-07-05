import { CalendarDays, CreditCard, ShieldCheck, Users } from 'lucide-react';
import ProgressBar from '../ui/ProgressBar';
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

  return (
    <div className="dashboard-card overflow-hidden p-0">
      <div className="border-b border-theme-border bg-gradient-to-r from-emerald-500/[0.06] via-transparent to-whatsapp-500/[0.04] px-5 py-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200/80 bg-theme-surface/80 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-whatsapp-700 dark:text-whatsapp-400">
            <CreditCard className="h-3 w-3" />
            Current plan
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">
            <ShieldCheck className="h-3 w-3" />
            {formatStatus(info.subscriptionStatus)}
          </span>
        </div>

        <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-2xl font-extrabold tracking-tight text-theme-fg sm:text-3xl">
              {info.currentPlan.name}
            </p>
            <p className="mt-1 text-[15px] font-bold text-theme-secondary">
              {info.currentPlan.priceLabel}
            </p>
            {info.planExpiresAt && (
              <p className="mt-2 inline-flex items-center gap-1.5 text-[12px] font-medium text-amber-700 dark:text-amber-300">
                <CalendarDays className="h-3.5 w-3.5" />
                Renews{' '}
                {new Date(info.planExpiresAt).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </p>
            )}
          </div>

          <div className="flex items-center gap-3 rounded-xl border border-theme-border/70 bg-theme-subtle/40 px-4 py-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-whatsapp-500/10 text-whatsapp-600">
              <Users className="h-4 w-4" />
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
        </div>
      </div>

      <div className="px-5 py-4">
        <ProgressBar value={info.seatsUsed} max={info.seatLimit} label="Seat usage" showPercent />
        <p className="mt-2 text-[12px] text-theme-secondary">
          {seatsNearLimit
            ? 'You are nearing your seat limit — consider upgrading.'
            : `${Math.max(0, info.seatLimit - info.seatsUsed)} seats available for new members`}
        </p>
      </div>
    </div>
  );
}
