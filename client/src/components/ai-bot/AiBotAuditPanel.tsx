import { useEffect, useState } from 'react';
import { ClipboardList } from 'lucide-react';
import LoadingState from '../ui/LoadingState';
import { aiBotApi } from '../../services/api';
import type { AiBotAuditLog } from '../../types';

const actionLabels: Record<string, string> = {
  create: 'Bot created',
  update: 'Settings updated',
  delete: 'Bot deleted',
  restore: 'Version restored',
};

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

interface AiBotAuditPanelProps {
  botId: string;
}

export default function AiBotAuditPanel({ botId }: AiBotAuditPanelProps) {
  const [logs, setLogs] = useState<AiBotAuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    aiBotApi
      .audit(botId)
      .then(({ data }) => setLogs(data.data.logs))
      .catch(() => setLogs([]))
      .finally(() => setLoading(false));
  }, [botId]);

  if (loading) return <LoadingState label="Loading activity..." />;

  if (logs.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-theme-border px-4 py-8 text-center text-[12px] text-theme-secondary">
        No activity recorded for this bot yet.
      </p>
    );
  }

  return (
    <div className="relative space-y-0">
      <div className="absolute bottom-2 left-[15px] top-2 w-px bg-theme-border/60" aria-hidden />
      {logs.map((log) => (
        <div key={log.id} className="relative flex gap-3 pb-4 last:pb-0">
          <div className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-theme-border bg-theme-bg">
            <ClipboardList className="h-3.5 w-3.5 text-theme-muted" />
          </div>
          <div className="min-w-0 flex-1 pt-0.5">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <p className="text-[13px] font-semibold text-theme-fg">
                {actionLabels[log.action] ?? log.action}
              </p>
              <span className="text-[11px] text-theme-muted">{formatRelativeTime(log.createdAt)}</span>
            </div>
            {log.changes && Object.keys(log.changes).length > 0 && (
              <p className="mt-0.5 text-[11px] text-theme-secondary">
                Changed: {Object.keys(log.changes).join(', ')}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
