import { Bot, Clock, PhoneCall, PhoneMissed, TrendingUp } from 'lucide-react';

interface CallStatsSummaryProps {
  total: number;
  today: number;
  live: number;
  aiAnswered: number;
  missed: number;
  avgDurationSec: number;
}

function formatAvg(seconds: number): string {
  if (seconds <= 0) return '—';
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

export default function CallStatsSummary({
  total,
  today,
  live,
  aiAnswered,
  missed,
  avgDurationSec,
}: CallStatsSummaryProps) {
  const items = [
    { label: 'Total calls', value: total, icon: PhoneCall, tone: 'text-neutral-900' },
    { label: 'Today', value: today, icon: TrendingUp, tone: 'text-violet-700' },
    { label: 'Live now', value: live, icon: PhoneCall, tone: live > 0 ? 'text-whatsapp-600' : 'text-neutral-500' },
    { label: 'AI answered', value: aiAnswered, icon: Bot, tone: 'text-violet-700' },
    { label: 'Missed', value: missed, icon: PhoneMissed, tone: missed > 0 ? 'text-amber-700' : 'text-neutral-500' },
    { label: 'Avg duration', value: formatAvg(avgDurationSec), icon: Clock, tone: 'text-neutral-800' },
  ];

  return (
    <div className="dashboard-card p-4 sm:p-5">
      <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-neutral-500">Call metrics</p>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.label}
              className="rounded-xl border border-neutral-200/60 bg-gradient-to-br from-white to-neutral-50/80 px-3 py-2.5"
            >
              <div className="flex items-center gap-1.5">
                <Icon className="h-3.5 w-3.5 text-neutral-400" />
                <p className="text-[10px] font-bold uppercase tracking-wide text-neutral-500">{item.label}</p>
              </div>
              <p className={`mt-1 text-lg font-extrabold tabular-nums tracking-tight ${item.tone}`}>{item.value}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function computeCallStats(calls: Array<{
  status: string;
  handler: string;
  durationSeconds?: number | null;
  createdAt: string;
}>) {
  const now = new Date();
  const today = calls.filter((c) => new Date(c.createdAt).toDateString() === now.toDateString()).length;
  const aiAnswered = calls.filter((c) => c.handler === 'AI').length;
  const missed = calls.filter((c) => ['MISSED', 'FAILED', 'REJECTED'].includes(c.status)).length;
  const withDuration = calls.filter((c) => (c.durationSeconds ?? 0) > 0);
  const avgDurationSec =
    withDuration.length > 0
      ? withDuration.reduce((sum, c) => sum + (c.durationSeconds ?? 0), 0) / withDuration.length
      : 0;

  return { total: calls.length, today, aiAnswered, missed, avgDurationSec };
}
