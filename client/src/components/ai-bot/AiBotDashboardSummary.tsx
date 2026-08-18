import { CheckCircle2, Clock, MessageSquare, UserX } from 'lucide-react';
import type { BotAnalytics } from '../../types';

export interface AggregateAnalytics {
  totalReplies: number;
  successfulReplies: number;
  skippedReplies: number;
  failedReplies: number;
  handoffs: number;
  avgDurationMs: number;
  totalTokens: number;
  skipReasons: Record<string, number>;
  handoffReasons: Record<string, number>;
  botCount: number;
}

export function aggregateBotAnalytics(
  perBot: Array<{ botId: string; analytics: BotAnalytics | null }>
): AggregateAnalytics | null {
  const valid = perBot.filter((b) => b.analytics);
  if (valid.length === 0) return null;

  const agg: AggregateAnalytics = {
    totalReplies: 0,
    successfulReplies: 0,
    skippedReplies: 0,
    failedReplies: 0,
    handoffs: 0,
    avgDurationMs: 0,
    totalTokens: 0,
    skipReasons: {},
    handoffReasons: {},
    botCount: valid.length,
  };

  let durationSum = 0;
  let durationCount = 0;

  for (const { analytics } of valid) {
    if (!analytics) continue;
    agg.totalReplies += analytics.totalReplies;
    agg.successfulReplies += analytics.successfulReplies;
    agg.skippedReplies += analytics.skippedReplies;
    agg.failedReplies += analytics.failedReplies;
    agg.handoffs += analytics.handoffs;
    agg.totalTokens += analytics.totalTokens;
    if (analytics.avgDurationMs > 0) {
      durationSum += analytics.avgDurationMs;
      durationCount += 1;
    }
    for (const [reason, count] of Object.entries(analytics.skipReasons)) {
      agg.skipReasons[reason] = (agg.skipReasons[reason] || 0) + count;
    }
    for (const [reason, count] of Object.entries(analytics.handoffReasons)) {
      agg.handoffReasons[reason] = (agg.handoffReasons[reason] || 0) + count;
    }
  }

  agg.avgDurationMs = durationCount > 0 ? Math.round(durationSum / durationCount) : 0;
  return agg;
}

interface SummaryCardProps {
  loading: boolean;
  analytics: AggregateAnalytics | null;
}

function SkeletonCard() {
  return (
    <div className="dashboard-card-soft rounded-2xl p-3.5 sm:p-4">
      <div className="flex items-center gap-1.5">
        <div className="h-3.5 w-3.5 animate-pulse rounded bg-neutral-200 dark:bg-neutral-700" />
        <div className="h-3 w-20 animate-pulse rounded bg-neutral-200 dark:bg-neutral-700" />
      </div>
      <div className="mt-2 h-6 w-16 animate-pulse rounded bg-neutral-200 dark:bg-neutral-700" />
    </div>
  );
}

function successRateColor(rate: number): string {
  if (rate >= 80) return 'text-emerald-700 dark:text-emerald-400';
  if (rate >= 50) return 'text-amber-700 dark:text-amber-400';
  return 'text-red-700 dark:text-red-400';
}

export default function AiBotDashboardSummary({ loading, analytics }: SummaryCardProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  if (!analytics || analytics.totalReplies === 0) return null;

  const rate =
    analytics.totalReplies > 0
      ? Math.round((analytics.successfulReplies / analytics.totalReplies) * 100)
      : 0;

  const cards = [
    {
      label: 'Total replies',
      value: analytics.totalReplies.toLocaleString(),
      icon: MessageSquare,
      tone: 'text-sky-700 dark:text-sky-400',
      bg: 'bg-sky-50 dark:bg-sky-950/40',
    },
    {
      label: 'Success rate',
      value: `${rate}%`,
      icon: CheckCircle2,
      tone: successRateColor(rate),
      bg: rate >= 80 ? 'bg-emerald-50 dark:bg-emerald-950/40' : rate >= 50 ? 'bg-amber-50 dark:bg-amber-950/40' : 'bg-red-50 dark:bg-red-950/40',
    },
    {
      label: 'Handoffs',
      value: analytics.handoffs.toLocaleString(),
      icon: UserX,
      tone: 'text-amber-700 dark:text-amber-400',
      bg: 'bg-amber-50 dark:bg-amber-950/40',
    },
    {
      label: 'Avg response',
      value: analytics.avgDurationMs > 0 ? `${(analytics.avgDurationMs / 1000).toFixed(1)}s` : '—',
      icon: Clock,
      tone: 'text-violet-700 dark:text-violet-400',
      bg: 'bg-violet-50 dark:bg-violet-950/40',
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div key={card.label} className="dashboard-card-soft rounded-2xl p-3.5 sm:p-4">
            <div className="flex items-center gap-1.5">
              <span className={`flex h-6 w-6 items-center justify-center rounded-lg ${card.bg}`}>
                <Icon className={`h-3.5 w-3.5 ${card.tone}`} strokeWidth={2.25} />
              </span>
              <p className="text-[10px] font-bold uppercase tracking-wide text-theme-muted">
                {card.label}
              </p>
            </div>
            <p className={`mt-2 text-xl font-extrabold tabular-nums tracking-tight ${card.tone}`}>
              {card.value}
            </p>
          </div>
        );
      })}
    </div>
  );
}
