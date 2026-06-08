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
    <div className="dashboard-card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
      <div className="flex min-w-0 items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 text-white shadow-[0_4px_14px_rgba(14,165,233,0.3)]">
          <Gauge className="h-4 w-4" strokeWidth={2.25} />
        </div>
        <div className="min-w-0">
          <p className="text-[13px] font-extrabold text-theme-fg">Daily send quota</p>
          <p className="mt-0.5 text-[12px] font-medium text-theme-secondary">
            <span className={`font-bold tabular-nums ${tone}`}>{quota.sentToday}</span> of{' '}
            <span className="font-bold tabular-nums">{quota.limit}</span> messages sent today ·{' '}
            <span className="font-bold tabular-nums">{quota.remaining}</span> remaining
          </p>
          <div className="mt-2 h-1.5 max-w-xs overflow-hidden rounded-full bg-theme-subtle">
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
        to="/settings"
        className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-theme-border bg-theme-surface px-3 py-2 text-[12px] font-bold text-theme-secondary transition hover:border-sky-300 hover:text-sky-700"
      >
        <Settings className="h-3.5 w-3.5" />
        Campaign settings
      </Link>
    </div>
  );
}
