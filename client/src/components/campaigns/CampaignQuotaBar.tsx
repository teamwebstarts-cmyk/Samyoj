import { useEffect, useState } from 'react';
import { campaignApi } from '../../services/api';

export interface CampaignQuotaUsage {
  sentToday: number;
  dailySendLimit: number;
  reservedSendCount?: number;
  remaining: number;
}

interface CampaignQuotaBarProps {
  compact?: boolean;
}

export default function CampaignQuotaBar({ compact = false }: CampaignQuotaBarProps) {
  const [usage, setUsage] = useState<CampaignQuotaUsage | null>(null);

  useEffect(() => {
    let cancelled = false;
    campaignApi.quota().then(({ data }) => {
        if (cancelled) return;
        const payload = data?.data as CampaignQuotaUsage | undefined;
        if (
          payload &&
          typeof payload.sentToday === 'number' &&
          typeof payload.dailySendLimit === 'number' &&
          typeof payload.remaining === 'number'
        ) {
          setUsage(payload);
        }
      })
      .catch(() => {
        /* toolbar stays quiet if quota cannot load */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!usage) return null;

  const pct = usage.dailySendLimit > 0
    ? Math.min(100, Math.round(((usage.sentToday + (usage.reservedSendCount || 0)) / usage.dailySendLimit) * 100))
    : 0;
  const barTone = pct >= 100 ? 'bg-rose-500' : pct >= 80 ? 'bg-amber-500' : 'bg-emerald-500';

  return (
    <div
      className={`min-w-0 ${compact ? 'w-full sm:w-56' : 'w-full'}`}
      title="Samyoj daily campaign recipient cap. This is not Meta remaining unique users."
    >
      <div className="flex items-center justify-between gap-2 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
        <span className="truncate">Samyoj daily send cap</span>
        <span className="shrink-0 tabular-nums text-slate-900 dark:text-white">
          {usage.sentToday.toLocaleString()} / {usage.dailySendLimit.toLocaleString()}
        </span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
        <div className={`h-full rounded-full ${barTone}`} style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-1 text-[10px] font-medium text-slate-400">
        {usage.remaining.toLocaleString()} remaining today
        {usage.reservedSendCount ? ` · ${usage.reservedSendCount.toLocaleString()} reserved` : ''}
      </p>
    </div>
  );
}
