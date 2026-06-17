import { BarChart3, CheckCircle2, XCircle } from 'lucide-react';
import LoadingState from '../ui/LoadingState';
import { triggerMeta } from '../flows/flowMeta';
import type { AutomationAnalytics } from '../../types';

const quickReplyTriggerLabels: Record<string, string> = {
  KEYWORD: 'Keyword reply',
  WELCOME: 'Welcome message',
  AWAY: 'Away message',
  BUSINESS_HOURS: 'Business hours',
  LEAD_CAPTURE: 'Lead capture',
  AI_CHATBOT: 'AI chatbot',
};

const actionLabels: Record<string, string> = {
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
  return actionLabels[action] || action.replace(/_/g, ' ');
}

function getStatusLabel(status: string): string {
  if (status === 'success') return 'Worked';
  if (status === 'failed') return "Didn't work";
  if (status === 'skipped') return 'Not sent';
  return status;
}

interface AutomationAnalyticsPanelProps {
  analytics: AutomationAnalytics | null;
  loading: boolean;
}

export default function AutomationAnalyticsPanel({ analytics, loading }: AutomationAnalyticsPanelProps) {
  if (loading) return <LoadingState label="Loading stats..." />;

  if (!analytics) {
    return (
      <div className="rounded-2xl border border-dashed border-neutral-200 px-6 py-10 text-center text-[13px] text-neutral-500">
        No activity yet. Turn on an auto-reply or multi-step flow to start seeing stats here.
      </div>
    );
  }

  const triggerEntries = Object.entries(analytics.byTrigger).sort((a, b) => b[1] - a[1]);

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-4">
        {[
          { label: 'Total replies sent', value: analytics.total, icon: BarChart3, tone: 'text-violet-700' },
          { label: 'Sent OK', value: analytics.success, icon: CheckCircle2, tone: 'text-emerald-700' },
          { label: "Didn't send", value: analytics.failed, icon: XCircle, tone: 'text-red-700' },
          { label: 'Not sent', value: analytics.skipped, icon: BarChart3, tone: 'text-amber-700' },
        ].map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="dashboard-card p-4">
              <div className="flex items-center gap-2">
                <Icon className={`h-4 w-4 ${stat.tone}`} />
                <p className="text-[11px] font-bold uppercase tracking-wide text-neutral-500">{stat.label}</p>
              </div>
              <p className={`mt-2 text-2xl font-extrabold ${stat.tone}`}>{stat.value}</p>
            </div>
          );
        })}
      </div>

      {triggerEntries.length > 0 && (
        <div className="dashboard-card p-4">
          <p className="text-[13px] font-extrabold text-neutral-900">By type</p>
          <div className="mt-3 space-y-2">
            {triggerEntries.map(([trigger, count]) => (
              <div key={trigger} className="flex items-center justify-between text-[13px]">
                <span className="font-semibold text-neutral-700">{getTriggerLabel(trigger)}</span>
                <span className="font-bold text-violet-700">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {analytics.recent.length > 0 && (
        <div className="dashboard-card overflow-hidden">
          <div className="border-b border-neutral-100 px-4 py-3">
            <p className="text-[13px] font-extrabold text-neutral-900">Recent activity</p>
          </div>
          <div className="divide-y divide-neutral-100">
            {analytics.recent.slice(0, 15).map((entry) => (
              <div key={entry.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-[12px]">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-neutral-800">
                    {getTriggerLabel(entry.triggerType)} · {getActionLabel(entry.action)}
                  </p>
                  <p className="text-neutral-500">{new Date(entry.createdAt).toLocaleString()}</p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                    entry.status === 'success'
                      ? 'bg-emerald-100 text-emerald-800'
                      : entry.status === 'failed'
                        ? 'bg-red-100 text-red-800'
                        : 'bg-neutral-100 text-neutral-600'
                  }`}
                >
                  {getStatusLabel(entry.status)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
