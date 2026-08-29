import {
  AlertOctagon,
  Gauge,
  ShieldCheck,
  UserMinus,
} from 'lucide-react';
import MetaCategoryDonut from '../charts/MetaCategoryDonut';
import type { ReportsMetaHealthData } from '../../../types';

interface ReportsMetaHealthTabProps {
  data: ReportsMetaHealthData;
}

export default function ReportsMetaHealthTab({ data }: ReportsMetaHealthTabProps) {
  const { quality, optOuts, categoryBreakdown, failureCodes } = data;

  const qualityColor =
    quality.rating === 'GREEN'
      ? 'text-emerald-700 dark:text-emerald-300'
      : quality.rating === 'YELLOW'
        ? 'text-amber-700 dark:text-amber-300'
        : 'text-rose-700 dark:text-rose-300';

  const qualityBadge =
    quality.rating === 'GREEN'
      ? 'bg-emerald-50 text-emerald-700 ring-emerald-200/80 dark:bg-emerald-950/50 dark:text-emerald-300 dark:ring-emerald-800/40'
      : quality.rating === 'YELLOW'
        ? 'bg-amber-50 text-amber-700 ring-amber-200/80 dark:bg-amber-950/50 dark:text-amber-300 dark:ring-amber-800/40'
        : 'bg-rose-50 text-rose-700 ring-rose-200/80 dark:bg-rose-950/50 dark:text-rose-300 dark:ring-rose-800/40';

  return (
    <div className="space-y-6">
      {/* Top Phone Quality & Tier Strip */}
      <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
        {/* Phone Quality Card */}
        <div className="dashboard-card p-5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-theme-muted uppercase tracking-wider">
              Phone Number Quality Rating
            </span>
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-black ring-1 ${qualityBadge}`}>
              {quality.status}
            </span>
          </div>

          <div className="mt-3 flex items-center gap-3">
            <span className={`flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300`}>
              <ShieldCheck className="h-5 w-5" />
            </span>
            <div>
              <p className={`text-xl font-black ${qualityColor}`}>{quality.rating} Status</p>
              <p className="text-[11px] font-medium text-theme-muted">
                Meta Cloud API phone number health score
              </p>
            </div>
          </div>
        </div>

        {/* Messaging Limit Tier */}
        <div className="dashboard-card p-5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-theme-muted uppercase tracking-wider">
              Meta messaging limit
            </span>
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-sky-50 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300">
              <Gauge className="h-3.5 w-3.5" />
            </span>
          </div>

          <div className="mt-3">
            <p className="text-xl font-black tabular-nums text-theme-fg">
              {quality.messagingLimitTier
                ? quality.messagingLimitTier.replace(/_/g, ' ')
                : 'Not polled yet'}
            </p>
            <p className="mt-1 text-[11px] font-medium text-theme-muted">
              Exact remaining unique users is in WhatsApp Manager. Graph does not give that integer.
            </p>
          </div>
        </div>

        {/* Opt-out / Block Card */}
        <div className="dashboard-card p-5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-theme-muted uppercase tracking-wider">
              Opt-Out & Unsubscribes
            </span>
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
              <UserMinus className="h-3.5 w-3.5" />
            </span>
          </div>

          <div className="mt-3">
            <p className="text-xl font-black tabular-nums text-theme-fg">
              {optOuts.count.toLocaleString()}{' '}
              <span className="text-[13px] font-semibold text-theme-muted">
                ({optOuts.ratePct}% opt-out rate)
              </span>
            </p>
            <p className="mt-0.5 text-[11px] font-medium text-theme-muted">
              Audience opt-out signals tracked to safeguard phone reputation
            </p>
          </div>
        </div>
      </div>

      {/* Meta Conversation Category Breakdown */}
      <div className="dashboard-card p-5">
        <MetaCategoryDonut categories={categoryBreakdown} />
      </div>

      {/* Meta Delivery Error Code Diagnostics */}
      <div className="dashboard-card overflow-hidden">
        <div className="border-b border-theme-border bg-theme-subtle/50 px-5 py-4">
          <h3 className="text-base font-extrabold tracking-tight text-theme-fg">
            Meta Dispatch Error Diagnostics
          </h3>
          <p className="mt-0.5 text-[12px] font-medium text-theme-secondary">
            Root cause analysis and resolution recommendations for failed WhatsApp dispatches
          </p>
        </div>

        <div className="divide-y divide-theme-border/60">
          {failureCodes.map((item) => (
            <div
              key={item.code}
              className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between hover:bg-theme-subtle/40 transition-colors"
            >
              <div className="flex items-start gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
                  <AlertOctagon className="h-4 w-4" />
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[11px] font-black text-rose-700 dark:text-rose-300">
                      Code {item.code}
                    </span>
                    <span className="font-bold text-[13px] text-theme-fg">{item.title}</span>
                  </div>
                  <p className="mt-0.5 text-[11px] font-medium text-theme-muted">
                    Recommendation: {item.suggestion}
                  </p>
                </div>
              </div>

              <div className="text-right">
                <span className="rounded-lg bg-rose-50 px-2.5 py-1 text-[11px] font-black tabular-nums text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
                  {item.count.toLocaleString()} occurrences
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
