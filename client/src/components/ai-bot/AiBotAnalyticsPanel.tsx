import { Link } from 'react-router-dom';
import { BarChart3, CheckCircle2, Clock, SkipForward, UserX, XCircle } from 'lucide-react';
import EmptyState from '../ui/EmptyState';
import LoadingState from '../ui/LoadingState';
import type { BotAnalytics } from '../../types';

interface AiBotAnalyticsPanelProps {
  analytics: BotAnalytics | null;
  loading: boolean;
}

function ReasonList({ title, reasons }: { title: string; reasons: Record<string, number> }) {
  const entries = Object.entries(reasons).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) return null;

  return (
    <div className="rounded-xl bg-theme-surface px-3 py-2.5 ring-1 ring-theme-border">
      <p className="text-[11px] font-bold uppercase tracking-wide text-theme-muted">{title}</p>
      <div className="mt-2 space-y-1.5">
        {entries.map(([reason, count]) => (
          <div key={reason} className="flex items-center justify-between text-[12px]">
            <span className="font-medium text-theme-secondary">{reason.replace(/_/g, ' ')}</span>
            <span className="font-bold tabular-nums text-theme-fg">{count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AiBotAnalyticsPanel({ analytics, loading }: AiBotAnalyticsPanelProps) {
  if (loading) return <LoadingState label="Loading analytics..." />;

  if (!analytics) {
    return (
      <EmptyState
        icon={BarChart3}
        compact
        title="No stats yet"
        description="Numbers will show up here after your bot starts replying to customers."
        steps={['Make sure your bot is turned on', 'Send a test message to your WhatsApp number', 'Check back here for reply stats']}
      />
    );
  }

  const stats = [
    { label: 'Replies sent', value: analytics.successfulReplies, icon: CheckCircle2, tone: 'text-emerald-700' },
    { label: 'Handoffs', value: analytics.handoffs, icon: UserX, tone: 'text-amber-700' },
    { label: 'Skipped', value: analytics.skippedReplies, icon: SkipForward, tone: 'text-sky-700' },
    { label: 'Failed', value: analytics.failedReplies, icon: XCircle, tone: 'text-red-700' },
    {
      label: 'Avg response',
      value: analytics.avgDurationMs ? `${Math.round(analytics.avgDurationMs / 1000)}s` : '—',
      icon: Clock,
      tone: 'text-violet-700',
    },
    { label: 'Tokens used', value: analytics.totalTokens, icon: BarChart3, tone: 'text-indigo-700' },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="rounded-xl bg-theme-surface p-3 ring-1 ring-theme-border">
              <div className="flex items-center gap-1.5">
                <Icon className={`h-3.5 w-3.5 ${stat.tone}`} />
                <p className="text-[10px] font-bold uppercase tracking-wide text-theme-muted">{stat.label}</p>
              </div>
              <p className={`mt-1.5 text-lg font-extrabold tabular-nums ${stat.tone}`}>{stat.value}</p>
            </div>
          );
        })}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <ReasonList title="Skip reasons" reasons={analytics.skipReasons} />
        <ReasonList title="Handoff reasons" reasons={analytics.handoffReasons} />
      </div>

      {analytics.recentRuns.length > 0 && (
        <div className="overflow-hidden rounded-xl ring-1 ring-theme-border">
          <div className="border-b border-theme-border bg-theme-subtle/50 px-3 py-2.5">
            <p className="text-[12px] font-extrabold text-theme-fg">Recent activity</p>
          </div>
          <div className="max-h-52 divide-y divide-theme-border overflow-y-auto">
            {analytics.recentRuns.slice(0, 15).map((run) => (
              <div key={run.id} className="flex items-center justify-between gap-3 px-3 py-2 text-[12px]">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-theme-fg">
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
                  <p className="text-[11px] text-theme-muted">{new Date(run.createdAt).toLocaleString()}</p>
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
      )}
    </div>
  );
}
