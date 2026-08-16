import { BarChart3, Bot, PhoneCall, PhoneMissed, User } from 'lucide-react';
import LoadingState from '../ui/LoadingState';

export interface CallAnalyticsData {
  total: number;
  today: number;
  live: number;
  aiAnswered: number;
  agentAnswered: number;
  missed: number;
  failed: number;
  avgDurationSec: number;
  inbound: number;
  outbound: number;
  byDay: Array<{ date: string; count: number; completed: number; missed: number }>;
}

interface CallAnalyticsPanelProps {
  data: CallAnalyticsData | null;
  loading?: boolean;
}

function formatDuration(sec: number): string {
  if (sec <= 0) return '—';
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

export default function CallAnalyticsPanel({ data, loading }: CallAnalyticsPanelProps) {
  if (loading) return <LoadingState label="Loading analytics..." />;
  if (!data) return null;

  const stats = [
    { label: 'Total', value: data.total, icon: PhoneCall },
    { label: 'AI handled', value: data.aiAnswered, icon: Bot },
    { label: 'Agent handled', value: data.agentAnswered, icon: User },
    { label: 'Missed', value: data.missed, icon: PhoneMissed },
    { label: 'Avg duration', value: formatDuration(data.avgDurationSec), icon: BarChart3 },
    { label: 'Outgoing', value: data.outbound, icon: PhoneCall },
  ];

  const maxDay = Math.max(...data.byDay.map((d) => d.count), 1);

  return (
    <div className="dashboard-card space-y-4 p-4 sm:p-5">
      <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-neutral-500">
        Call analytics (30 days)
      </p>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {stats.map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.label}
              className="rounded-xl border border-neutral-200/60 bg-gradient-to-br from-white to-neutral-50/80 px-3 py-2.5"
            >
              <div className="flex items-center gap-1.5">
                <Icon className="h-3.5 w-3.5 text-neutral-400" />
                <p className="text-[10px] font-bold uppercase tracking-wide text-neutral-500">
                  {item.label}
                </p>
              </div>
              <p className="mt-1 text-lg font-extrabold tabular-nums text-neutral-900">{item.value}</p>
            </div>
          );
        })}
      </div>

      {data.byDay.length > 0 && (
        <div>
          <p className="mb-2 text-[12px] font-bold text-neutral-700">Daily volume</p>
          <div className="flex h-24 items-end gap-1">
            {data.byDay.slice(-14).map((day) => (
              <div key={day.date} className="flex flex-1 flex-col items-center gap-1">
                <div
                  className="w-full rounded-t bg-gradient-to-t from-violet-500 to-violet-400"
                  style={{ height: `${Math.max(8, (day.count / maxDay) * 80)}px` }}
                  title={`${day.date}: ${day.count} calls`}
                />
                <span className="text-[8px] font-medium text-neutral-400">
                  {day.date.slice(5)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
