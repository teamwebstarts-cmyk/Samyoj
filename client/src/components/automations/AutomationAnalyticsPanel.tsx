import {
  Activity,
  BarChart3,
  CheckCircle2,
  MinusCircle,
  TrendingUp,
  XCircle,
} from 'lucide-react';
import StatCard from '../dashboard/StatCard';
import EmptyState from '../ui/EmptyState';
import LoadingState from '../ui/LoadingState';
import ProgressBar from '../ui/ProgressBar';
import SectionCard from '../ui/SectionCard';
import { triggerMeta, nodeMeta } from '../flows/flowMeta';
import type { AutomationAnalytics } from '../../types';

const quickReplyTriggerLabels: Record<string, string> = {
  KEYWORD: 'Keyword reply',
  WELCOME: 'Welcome message',
  AWAY: 'Away message',
  BUSINESS_HOURS: 'Business hours',
  LEAD_CAPTURE: 'Lead capture',
  AI_CHATBOT: 'AI chatbot',
  FLOW: 'Multi-step flow',
};

const actionLabels: Record<string, string> = {
  send_reply: 'Reply sent',
  generate_reply: 'AI reply generated',
  sent: 'Reply sent',
  skipped: 'Not sent',
  failed: 'Did not send',
  handoff: 'Passed to team',
  tagged: 'Tag added',
};

function getTriggerLabel(trigger: string): string {
  return quickReplyTriggerLabels[trigger] || triggerMeta[trigger]?.label || trigger;
}

function getActionLabel(action: string): string {
  if (actionLabels[action]) return actionLabels[action];
  if (action.startsWith('node:')) {
    const nodeType = action.slice(5);
    const label = nodeMeta[nodeType as keyof typeof nodeMeta]?.label;
    return label ? `${label} step` : action.replace(/^node:/, '').replace(/_/g, ' ');
  }
  return action.replace(/_/g, ' ');
}

function getStatusLabel(status: string): string {
  if (status === 'success') return 'Worked';
  if (status === 'failed') return "Didn't work";
  if (status === 'skipped') return 'Not sent';
  return status;
}

function getStatusStyles(status: string): string {
  if (status === 'success') {
    return 'bg-emerald-500/10 text-emerald-700 ring-emerald-500/20 dark:text-emerald-300';
  }
  if (status === 'failed') {
    return 'bg-rose-500/10 text-rose-700 ring-rose-500/20 dark:text-rose-300';
  }
  return 'bg-theme-subtle text-theme-secondary ring-theme-border';
}

interface AutomationAnalyticsPanelProps {
  analytics: AutomationAnalytics | null;
  loading: boolean;
}

export default function AutomationAnalyticsPanel({ analytics, loading }: AutomationAnalyticsPanelProps) {
  if (loading) return <LoadingState label="Loading stats..." />;

  if (!analytics) {
    return (
      <EmptyState
        icon={BarChart3}
        title="No activity yet"
        description="Stats will appear here once you turn on an auto-reply or conversation flow."
        steps={['Create or turn on an auto-reply', 'Wait for customers to message you', 'Come back here to see the numbers']}
        compact
      />
    );
  }

  const triggerEntries = Object.entries(analytics.byTrigger).sort((a, b) => b[1] - a[1]);
  const maxTriggerCount = triggerEntries[0]?.[1] ?? 1;
  const successRate = analytics.total > 0 ? Math.round((analytics.success / analytics.total) * 100) : 0;

  return (
    <div className="space-y-5 sm:space-y-6">
      <div className="card-grid-auto">
        <StatCard
          label="Times run"
          value={analytics.total}
          icon={BarChart3}
          accent="violet"
          delay={0}
        />
        <StatCard
          label="Sent OK"
          value={analytics.success}
          icon={CheckCircle2}
          accent="emerald"
          hint={analytics.total > 0 ? `${successRate}% success` : undefined}
          delay={60}
        />
        <StatCard
          label="Didn't send"
          value={analytics.failed}
          icon={XCircle}
          accent="rose"
          delay={120}
        />
        <StatCard
          label="Skipped"
          value={analytics.skipped}
          icon={MinusCircle}
          accent="amber"
          delay={180}
        />
      </div>

      {analytics.total > 0 && (
        <div className="dashboard-card overflow-hidden p-0">
          <div className="border-b border-theme-border/60 bg-gradient-to-r from-violet-500/[0.06] via-emerald-500/[0.04] to-transparent px-4 py-3.5 sm:px-5">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-500/10 text-violet-600">
                <TrendingUp className="h-4 w-4" />
              </div>
              <div>
                <p className="text-[13px] font-extrabold text-theme-fg">Delivery health</p>
                <p className="text-[12px] text-theme-secondary">Last 30 days performance overview</p>
              </div>
            </div>
          </div>
          <div className="grid gap-4 p-4 sm:grid-cols-3 sm:p-5">
            <div className="sm:col-span-2">
              <ProgressBar value={successRate} label="Successful deliveries" />
            </div>
            <div className="flex items-center justify-around gap-2 rounded-xl bg-theme-subtle/40 px-3 py-3 sm:flex-col sm:justify-center">
              {[
                { label: 'OK', value: analytics.success, color: 'bg-emerald-500' },
                { label: 'Failed', value: analytics.failed, color: 'bg-rose-500' },
                { label: 'Skip', value: analytics.skipped, color: 'bg-amber-400' },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-2 text-[12px]">
                  <span className={`h-2 w-2 rounded-full ${item.color}`} />
                  <span className="font-semibold text-theme-secondary">{item.label}</span>
                  <span className="font-extrabold tabular-nums text-theme-fg">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {triggerEntries.length > 0 && (
        <SectionCard title="By start rule" subtitle="What started automations in the last 30 days">
          <div className="space-y-3">
            {triggerEntries.map(([trigger, count]) => {
              const width = Math.max(6, Math.round((count / maxTriggerCount) * 100));
              return (
                <div key={trigger} className="space-y-1.5">
                  <div className="flex items-center justify-between gap-3 text-[13px]">
                    <span className="truncate font-semibold text-theme-fg">{getTriggerLabel(trigger)}</span>
                    <span className="shrink-0 font-extrabold tabular-nums text-violet-700 dark:text-violet-300">
                      {count}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-theme-subtle">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-violet-500 to-indigo-500 transition-all duration-500"
                      style={{ width: `${width}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </SectionCard>
      )}

      {analytics.recent.length > 0 && (
        <SectionCard title="Recent activity" subtitle="Latest automation events">
          <div className="relative space-y-0">
            {analytics.recent.slice(0, 15).map((entry, index) => (
              <div
                key={entry.id}
                className="relative flex gap-3 pb-4 pl-1 last:pb-0"
              >
                {index < Math.min(analytics.recent.length, 15) - 1 && (
                  <span
                    className="absolute left-[11px] top-6 h-[calc(100%-12px)] w-px bg-theme-border"
                    aria-hidden
                  />
                )}
                <span
                  className={`relative z-[1] mt-1 flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full ring-2 ring-theme-surface ${
                    entry.status === 'success'
                      ? 'bg-emerald-500/15 text-emerald-600'
                      : entry.status === 'failed'
                        ? 'bg-rose-500/15 text-rose-600'
                        : 'bg-theme-subtle text-theme-muted'
                  }`}
                >
                  <Activity className="h-3 w-3" />
                </span>
                <div className="min-w-0 flex-1 rounded-xl border border-theme-border/60 bg-theme-subtle/20 px-3.5 py-2.5 transition hover:border-violet-500/20 hover:bg-theme-subtle/40">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-semibold text-theme-fg">
                        {getTriggerLabel(entry.triggerType)}
                      </p>
                      <p className="mt-0.5 text-[12px] text-theme-secondary">{getActionLabel(entry.action)}</p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ${getStatusStyles(entry.status)}`}
                    >
                      {getStatusLabel(entry.status)}
                    </span>
                  </div>
                  <p className="mt-1.5 text-[11px] font-medium text-theme-muted">
                    {new Date(entry.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      )}
    </div>
  );
}
