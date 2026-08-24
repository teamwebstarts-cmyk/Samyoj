import { Bot, Phone } from 'lucide-react';
import type { AiCreditBalanceView } from '../../types';

function formatPeriodEnd(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  } catch {
    return '';
  }
}

function getBarColor(pct: number, defaultClass: string): string {
  if (pct >= 95) return 'bg-rose-500';
  if (pct >= 80) return 'bg-amber-500';
  return defaultClass;
}

interface BillingAiCreditMeterProps {
  title: string;
  unitLabel: string;
  balance: AiCreditBalanceView | null;
  icon: 'chat' | 'calling';
  isEntitled: boolean;
  onBuyMore?: () => void;
}

export default function BillingAiCreditMeter({
  title,
  unitLabel,
  balance,
  icon,
  isEntitled,
  onBuyMore,
}: BillingAiCreditMeterProps) {
  const Icon = icon === 'chat' ? Bot : Phone;
  const includedLimit = balance?.includedLimit ?? 0;
  const includedUsed = balance?.includedUsed ?? 0;
  const addonBalance = balance?.addonBalance ?? 0;
  const totalRemaining = balance?.totalRemaining ?? 0;
  const includedPct =
    includedLimit > 0 ? Math.min(100, Math.round((includedUsed / includedLimit) * 100)) : 0;
  const periodEndLabel = balance?.periodEnd ? formatPeriodEnd(balance.periodEnd) : '';

  if (!isEntitled && includedLimit === 0 && addonBalance === 0) {
    return (
      <div className="flex flex-col justify-between rounded-xl border border-theme-border bg-theme-subtle/30 p-4">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-violet-50 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300">
            <Icon className="h-3.5 w-3.5" />
          </span>
          <span className="truncate text-[11px] font-bold uppercase tracking-wider text-theme-muted">
            {title}
          </span>
        </div>
        <p className="mt-2.5 text-sm font-bold text-theme-muted">Not included on your plan</p>
        {onBuyMore ? (
          <button
            type="button"
            onClick={onBuyMore}
            className="mt-2 text-left text-[11px] font-bold text-whatsapp-700 hover:underline"
          >
            Upgrade for AI →
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col justify-between rounded-xl border border-theme-border bg-theme-subtle/30 p-4">
      <div>
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-violet-50 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300">
            <Icon className="h-3.5 w-3.5" />
          </span>
          <span className="truncate text-[11px] font-bold uppercase tracking-wider text-theme-muted">
            {title}
          </span>
        </div>

        <div className="mt-2.5 space-y-1">
          <p className="text-lg font-black tabular-nums text-theme-fg">
            {totalRemaining.toLocaleString()}{' '}
            <span className="text-xs font-semibold text-theme-muted">{unitLabel} left</span>
          </p>
          {includedLimit > 0 ? (
            <p className="text-[11px] font-medium text-theme-muted">
              From your plan: {includedUsed.toLocaleString()} / {includedLimit.toLocaleString()} used
              {periodEndLabel ? ` · resets ${periodEndLabel}` : ''}
            </p>
          ) : null}
          <p className="text-[11px] font-medium text-theme-secondary">
            Add-on balance: {addonBalance.toLocaleString()} {unitLabel}
            {addonBalance > 0 ? ' (does not expire)' : ''}
          </p>
        </div>
      </div>

      <div className="mt-3">
        {includedLimit > 0 ? (
          <>
            <div className="h-2 overflow-hidden rounded-full bg-theme-subtle">
              <div
                className={`h-full rounded-full transition-all duration-500 ${getBarColor(includedPct, 'bg-violet-500')}`}
                style={{ width: `${includedPct}%` }}
              />
            </div>
            <p className="mt-1.5 flex items-center justify-between gap-2 text-[11px] font-medium text-theme-muted">
              <span>Monthly included usage</span>
              <span className="shrink-0 font-semibold tabular-nums">{includedPct}%</span>
            </p>
          </>
        ) : (
          <div className="h-2 overflow-hidden rounded-full bg-theme-subtle">
            <div
              className="h-full rounded-full bg-violet-500 transition-all duration-500"
              style={{
                width: `${addonBalance > 0 ? Math.min(100, addonBalance) : 0}%`,
              }}
            />
          </div>
        )}
        {includedPct >= 80 && onBuyMore ? (
          <button
            type="button"
            onClick={onBuyMore}
            className="mt-2 text-[11px] font-bold text-whatsapp-700 hover:underline"
          >
            Running low — add a top-up pack →
          </button>
        ) : null}
        {totalRemaining === 0 && onBuyMore ? (
          <button
            type="button"
            onClick={onBuyMore}
            className="mt-2 text-[11px] font-bold text-rose-700 hover:underline dark:text-rose-400"
          >
            Out of credits — buy an add-on pack →
          </button>
        ) : null}
      </div>
    </div>
  );
}
