import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BarChart3,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  SkipForward,
  UserX,
  XCircle,
} from 'lucide-react';
import type { AggregateAnalytics } from './AiBotDashboardSummary';
import type { BotAnalytics } from '../../types';

interface AggregateAnalyticsSectionProps {
  analytics: AggregateAnalytics | null;
  perBotAnalytics: Array<{ botName: string; botId: string; analytics: BotAnalytics | null }>;
  loading: boolean;
}

function BarChart({
  title,
  reasons,
  color,
}: {
  title: string;
  reasons: Record<string, number>;
  color: string;
}) {
  const entries = Object.entries(reasons).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) return null;
  const max = entries[0]?.[1] ?? 1;

  return (
    <div className="rounded-xl bg-theme-surface px-3.5 py-3 ring-1 ring-theme-border">
      <p className="text-[11px] font-bold uppercase tracking-wide text-theme-muted">{title}</p>
      <div className="mt-2.5 space-y-2">
        {entries.map(([reason, count]) => (
          <div key={reason} className="space-y-1">
            <div className="flex items-center justify-between text-[12px]">
              <span className="font-medium text-theme-secondary">{reason.replace(/_/g, ' ')}</span>
              <span className="font-bold tabular-nums text-theme-fg">{count}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800">
              <div
                className={`h-full rounded-full ${color}`}
                style={{ width: `${Math.max(4, (count / max) * 100)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function RecentActivityFeed({
  perBot,
}: {
  perBot: Array<{ botName: string; botId: string; analytics: BotAnalytics | null }>;
}) {
  const allRuns = perBot
    .flatMap((b) =>
      (b.analytics?.recentRuns ?? []).map((run) => ({ ...run, botName: b.botName }))
    )
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 15);

  if (allRuns.length === 0) return null;

  return (
    <div className="overflow-hidden rounded-xl ring-1 ring-theme-border">
      <div className="border-b border-theme-border bg-theme-subtle/50 px-3.5 py-2.5">
        <p className="text-[12px] font-extrabold text-theme-fg">Recent activity</p>
      </div>
      <div className="max-h-64 divide-y divide-theme-border overflow-y-auto">
        {allRuns.map((run) => (
          <div
            key={run.id}
            className="flex items-center justify-between gap-3 px-3.5 py-2 text-[12px]"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold text-theme-fg">
                <span className="text-theme-muted">{run.botName}</span>
                {' · '}
                {run.action.replace(/_/g, ' ')}
                {run.conversationId && (
                  <>
                    {' · '}
                    <Link
                      to={`/inbox?conversation=${run.conversationId}`}
                      className="font-bold text-sky-700 underline underline-offset-2 dark:text-sky-400"
                    >
                      View chat
                    </Link>
                  </>
                )}
              </p>
              <p className="text-[11px] text-theme-muted">
                {new Date(run.createdAt).toLocaleString()}
              </p>
            </div>
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase ${
                run.status === 'success'
                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                  : run.status === 'failed'
                    ? 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300'
                    : 'bg-theme-subtle text-theme-muted'
              }`}
            >
              {run.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AiBotAggregateAnalytics({
  analytics,
  perBotAnalytics,
  loading,
}: AggregateAnalyticsSectionProps) {
  const [expanded, setExpanded] = useState(() =>
    typeof window !== 'undefined' && window.innerWidth >= 768
  );

  if (loading && !analytics) return null;

  if (!analytics || analytics.totalReplies === 0) {
    return (
      <div className="rounded-xl border border-dashed border-theme-border bg-theme-subtle/40 px-4 py-6 text-center">
        <BarChart3 className="mx-auto h-5 w-5 text-theme-muted" />
        <p className="mt-2 text-[13px] font-semibold text-theme-fg">No bot activity yet</p>
        <p className="mt-1 text-[12px] text-theme-muted">
          Turn on a bot and send a test message to see analytics here.
        </p>
      </div>
    );
  }

  const stats = [
    {
      label: 'Replies sent',
      value: analytics.successfulReplies,
      icon: CheckCircle2,
      tone: 'text-emerald-700',
    },
    { label: 'Handoffs', value: analytics.handoffs, icon: UserX, tone: 'text-amber-700' },
    { label: 'Skipped', value: analytics.skippedReplies, icon: SkipForward, tone: 'text-sky-700' },
    { label: 'Failed', value: analytics.failedReplies, icon: XCircle, tone: 'text-red-700' },
    {
      label: 'Avg response',
      value: analytics.avgDurationMs ? `${(analytics.avgDurationMs / 1000).toFixed(1)}s` : '—',
      icon: Clock,
      tone: 'text-violet-700',
    },
    {
      label: 'Tokens used',
      value: analytics.totalTokens.toLocaleString(),
      icon: BarChart3,
      tone: 'text-indigo-700',
    },
  ];

  return (
    <div className="rounded-2xl border border-theme-border bg-theme-surface">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-indigo-600 dark:text-indigo-400" strokeWidth={2.25} />
          <span className="text-[13px] font-extrabold text-theme-fg">Analytics & Insights</span>
          <span className="text-[11px] font-semibold text-theme-muted">30 days</span>
        </div>
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-theme-muted" />
        ) : (
          <ChevronDown className="h-4 w-4 text-theme-muted" />
        )}
      </button>

      {expanded && (
        <div className="space-y-4 border-t border-theme-border px-4 pb-4 pt-3">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {stats.map((stat) => {
              const Icon = stat.icon;
              return (
                <div
                  key={stat.label}
                  className="rounded-xl bg-theme-subtle/60 p-3 ring-1 ring-theme-border"
                >
                  <div className="flex items-center gap-1.5">
                    <Icon className={`h-3.5 w-3.5 ${stat.tone}`} />
                    <p className="text-[10px] font-bold uppercase tracking-wide text-theme-muted">
                      {stat.label}
                    </p>
                  </div>
                  <p className={`mt-1.5 text-lg font-extrabold tabular-nums ${stat.tone}`}>
                    {stat.value}
                  </p>
                </div>
              );
            })}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <BarChart
              title="Skip reasons"
              reasons={analytics.skipReasons}
              color="bg-sky-500"
            />
            <BarChart
              title="Handoff reasons"
              reasons={analytics.handoffReasons}
              color="bg-amber-500"
            />
          </div>

          <RecentActivityFeed perBot={perBotAnalytics} />
        </div>
      )}
    </div>
  );
}
