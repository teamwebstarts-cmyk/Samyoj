import { useEffect, useState } from 'react';
import { inboxApi } from '../../../services/api';
import type { ConversationStats } from '../../../types';

interface StatsRowProps {
  conversationId: string;
}

function formatAvgFirstResponse(minutes: number | null): string {
  if (minutes === null) return '—';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest > 0 ? `${hours}h ${rest}m` : `${hours}h`;
}

function StatChip({ value, label, title }: { value: string; label: string; title?: string }) {
  return (
    <div
      title={title}
      className="flex min-w-0 flex-col items-center gap-0.5 rounded-xl border border-theme-border px-2 py-2.5"
    >
      <span className="truncate text-[14px] font-extrabold tabular-nums text-theme-fg">{value}</span>
      <span className="truncate text-[9.5px] font-bold uppercase tracking-wide text-theme-muted">
        {label}
      </span>
    </div>
  );
}

/** Real per-contact stats for the open conversation. Hidden entirely on error — never fake numbers. */
export default function StatsRow({ conversationId }: StatsRowProps) {
  const [stats, setStats] = useState<ConversationStats | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setStats(null);
    setFailed(false);
    inboxApi
      .stats(conversationId)
      .then(({ data }) => {
        if (!cancelled) setStats(data.data);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [conversationId]);

  if (failed) return null;

  if (!stats) {
    return (
      <div className="mx-4 mb-4 grid grid-cols-3 gap-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="inbox-skeleton-shimmer h-[54px] rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="mx-4 mb-4 grid grid-cols-3 gap-2">
      <StatChip value={String(stats.totalChats)} label="Total Chats" />
      <StatChip value={String(stats.openTickets)} label="Open Tickets" />
      <StatChip
        value={formatAvgFirstResponse(stats.avgFirstResponseMinutes)}
        label="First response"
        title="Average time from customer message to first agent reply"
      />
    </div>
  );
}
