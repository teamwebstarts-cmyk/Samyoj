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

  const usedPct = Math.min(100, Math.round((quota.sentToday / Math.max(quota.limit, 1)) * 100));
  const tone =
    usedPct >= 90
      ? 'text-red-600 dark:text-red-400'
      : usedPct >= 70
        ? 'text-amber-600 dark:text-amber-400'
        : 'text-emerald-600 dark:text-emerald-400';
  const barTone =
    usedPct >= 90
      ? 'bg-gradient-to-r from-red-400 to-rose-500'
      : usedPct >= 70
        ? 'bg-gradient-to-r from-amber-400 to-orange-500'
        : 'bg-[#10b981]';

  return (
    <section className="rounded-[18px] border border-[#e8eef5] bg-white px-4 py-3.5 shadow-[0_8px_22px_rgba(15,23,42,0.035)] dark:border-slate-800 dark:bg-slate-950 sm:px-5 sm:py-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-5">
        {/* Left: icon + title/meta */}
        <div className="flex min-w-0 items-start gap-3 lg:w-[280px] lg:shrink-0">
          <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-[#e8faf2] text-emerald-600 dark:bg-emerald-950/45 dark:text-emerald-300">
            <Gauge className="h-[18px] w-[18px]" strokeWidth={2.25} />
          </span>
          <div className="min-w-0">
            <p className="text-[13px] font-extrabold leading-tight text-[#0f172a] dark:text-white">
              Daily campaign limit
            </p>
            <p className="mt-1 text-[12px] font-medium leading-snug text-[#94a3b8] dark:text-slate-400">
              <span className="tabular-nums text-[#64748b] dark:text-slate-300">
                {quota.sentToday.toLocaleString()}
              </span>{' '}
              of{' '}
              <span className="tabular-nums text-[#64748b] dark:text-slate-300">
                {quota.limit.toLocaleString()}
              </span>{' '}
              used
              <span className="mx-1.5 text-[#cbd5e1]">•</span>
              <span className="tabular-nums">{quota.remaining.toLocaleString()}</span> remaining
            </p>
          </div>
        </div>

        {/* Middle: progress + % */}
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="relative min-w-0 flex-1">
            <div className="mb-1.5 flex justify-end sm:hidden">
              <span className={`text-[12px] font-extrabold tabular-nums ${tone}`}>{usedPct}% used</span>
            </div>
            <div className="h-[6px] w-full overflow-hidden rounded-full bg-[#eef2f7] dark:bg-slate-800">
              <div
                className={`h-full rounded-full transition-all ${barTone}`}
                style={{ width: `${usedPct}%` }}
                role="progressbar"
                aria-valuenow={usedPct}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`Daily campaign limit: ${usedPct}% used`}
              />
            </div>
          </div>
          <span className={`hidden shrink-0 text-[12px] font-extrabold tabular-nums sm:inline ${tone}`}>
            {usedPct}% used
          </span>
        </div>

        {/* Right: manage */}
        <Link
          to="/settings?tab=campaigns"
          className="inline-flex min-h-10 shrink-0 items-center justify-center gap-1.5 self-end rounded-xl border border-[#e4e9f2] bg-[#f5f7fb] px-3.5 text-[12px] font-bold text-[#334155] transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/25 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-emerald-800 dark:hover:bg-emerald-950/30 lg:self-auto"
        >
          <Settings className="h-3.5 w-3.5" strokeWidth={2.25} />
          Manage campaign limits
        </Link>
      </div>
    </section>
  );
}
