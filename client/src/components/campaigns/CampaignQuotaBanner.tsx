import { Link } from 'react-router-dom';
import { Gauge, Settings } from 'lucide-react';
import { useEffect, useState } from 'react';
import { campaignApi } from '../../services/api';

interface QuotaData {
  sentToday: number;
  limit: number;
  remaining: number;
  batchSize: number;
  batchDelayMs: number;
}

export default function CampaignQuotaBanner() {
  const [quota, setQuota] = useState<QuotaData | null>(null);

  useEffect(() => {
    campaignApi
      .quota()
      .then(({ data }) => setQuota(data.data as QuotaData))
      .catch(() => setQuota(null));
  }, []);

  if (!quota) return null;

  const usedPct = Math.min(100, Math.round((quota.sentToday / quota.limit) * 100));
  const tone =
    usedPct >= 90 ? 'text-red-600 dark:text-red-400' : usedPct >= 70 ? 'text-amber-700 dark:text-amber-400' : 'text-emerald-700 dark:text-emerald-400';

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-theme-border bg-theme-subtle/25 px-3.5 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:px-4">
      <div className="flex min-w-0 items-center gap-2.5">
        <Gauge className="h-4 w-4 shrink-0 text-sky-600" strokeWidth={2.25} />
        <div className="min-w-0">
          <p className="text-[12px] font-extrabold text-theme-fg">Daily send quota</p>
          <p className="text-[11px] font-medium text-theme-secondary">
            <span className={`font-bold tabular-nums ${tone}`}>{quota.sentToday}</span> of{' '}
            <span className="font-bold tabular-nums">{quota.limit}</span> used ·{' '}
            <span className="font-bold tabular-nums">{quota.remaining}</span> remaining
          </p>
          <div className="mt-1.5 h-1 max-w-xs overflow-hidden rounded-full bg-theme-subtle">
            <div
              className={`h-full rounded-full bg-gradient-to-r ${
                usedPct >= 90 ? 'from-red-400 to-rose-600' : usedPct >= 70 ? 'from-amber-400 to-orange-500' : 'from-emerald-400 to-whatsapp-600'
              }`}
              style={{ width: `${usedPct}%` }}
            />
          </div>
        </div>
      </div>
      <Link
        to="/settings?tab=campaigns"
        className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-lg px-2 py-1.5 text-[11px] font-bold text-theme-secondary transition hover:bg-theme-surface hover:text-sky-700 sm:self-auto"
      >
        <Settings className="h-3.5 w-3.5" />
        Manage quota
      </Link>
    </div>
  );
}
