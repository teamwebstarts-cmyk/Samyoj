import { BookOpen, Clock, MessageSquare, UserX, AlertTriangle } from 'lucide-react';
import type { AggregateAnalytics } from './AiBotDashboardSummary';

interface InsightStripProps {
  analytics: AggregateAnalytics | null;
  loading: boolean;
  totalKnowledgeItems: number;
}

interface Insight {
  icon: typeof MessageSquare;
  iconBg: string;
  iconColor: string;
  text: string;
  link?: { label: string; href: string };
}

export default function AiBotInsights({ analytics, loading, totalKnowledgeItems }: InsightStripProps) {
  if (loading || !analytics) return null;

  const insights: Insight[] = [];

  if (analytics.handoffs > 0) {
    insights.push({
      icon: UserX,
      iconBg: 'bg-amber-50 dark:bg-amber-950/40',
      iconColor: 'text-amber-700 dark:text-amber-400',
      text: `${analytics.handoffs} customer${analytics.handoffs === 1 ? '' : 's'} handed off to a person this period`,
    });
  }

  if (analytics.skippedReplies > 0) {
    insights.push({
      icon: AlertTriangle,
      iconBg: 'bg-rose-50 dark:bg-rose-950/40',
      iconColor: 'text-rose-700 dark:text-rose-400',
      text: `${analytics.skippedReplies} message${analytics.skippedReplies === 1 ? '' : 's'} skipped — check training gaps`,
    });
  }

  if (analytics.avgDurationMs > 0) {
    insights.push({
      icon: Clock,
      iconBg: 'bg-violet-50 dark:bg-violet-950/40',
      iconColor: 'text-violet-700 dark:text-violet-400',
      text: `Response time: avg ${(analytics.avgDurationMs / 1000).toFixed(1)}s`,
    });
  }

  if (totalKnowledgeItems > 0) {
    insights.push({
      icon: BookOpen,
      iconBg: 'bg-sky-50 dark:bg-sky-950/40',
      iconColor: 'text-sky-700 dark:text-sky-400',
      text: `Training: ${totalKnowledgeItems} answer${totalKnowledgeItems === 1 ? '' : 's'} ready across all bots`,
    });
  }

  if (analytics.totalReplies === 0 && insights.length === 0) {
    insights.push({
      icon: MessageSquare,
      iconBg: 'bg-neutral-100 dark:bg-neutral-800',
      iconColor: 'text-neutral-500 dark:text-neutral-400',
      text: 'No activity yet — turn on a bot to see stats',
    });
  }

  if (insights.length === 0) return null;

  return (
    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
      {insights.map((insight, i) => {
        const Icon = insight.icon;
        return (
          <div
            key={i}
            className="flex shrink-0 items-center gap-2 rounded-xl border border-theme-border bg-theme-surface px-3 py-2"
          >
            <span className={`flex h-6 w-6 items-center justify-center rounded-lg ${insight.iconBg}`}>
              <Icon className={`h-3.5 w-3.5 ${insight.iconColor}`} strokeWidth={2.25} />
            </span>
            <span className="whitespace-nowrap text-[12px] font-semibold text-theme-secondary">
              {insight.text}
            </span>
          </div>
        );
      })}
    </div>
  );
}
