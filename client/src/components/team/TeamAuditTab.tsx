import { useEffect, useState } from 'react';
import { ClipboardList } from 'lucide-react';
import LoadingState from '../ui/LoadingState';
import SectionCard from '../ui/SectionCard';
import { teamApi } from '../../services/api';
import type { TeamAuditLog } from '../../types';
import { auditActionLabels, formatRelativeTime } from './teamUi';

export default function TeamAuditTab() {
  const [logs, setLogs] = useState<TeamAuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    teamApi.audit(50)
      .then(({ data }) => setLogs(data.data.logs))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingState label="Loading activity log..." />;

  return (
    <SectionCard
      title="Activity log"
      subtitle="Track team changes, invites, and security events"
    >
      {logs.length === 0 ? (
        <p className="py-8 text-center text-[13px] text-theme-secondary">No activity yet</p>
      ) : (
        <div className="relative space-y-0">
          <div className="absolute bottom-2 left-[15px] top-2 w-px bg-theme-border/60" aria-hidden />
          {logs.map((log) => (
            <div key={log.id} className="relative flex gap-4 pb-5 last:pb-0">
              <div className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-theme-border bg-theme-bg">
                <ClipboardList className="h-3.5 w-3.5 text-theme-muted" />
              </div>
              <div className="min-w-0 flex-1 pt-0.5">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <p className="text-[13px] font-semibold text-theme-fg">
                    {auditActionLabels[log.action] ?? log.action}
                  </p>
                  <span className="text-[11px] text-theme-muted">
                    {formatRelativeTime(log.createdAt)}
                  </span>
                </div>
                <p className="mt-0.5 text-[12px] text-theme-secondary">
                  {log.actor?.name && <span>{log.actor.name}</span>}
                  {log.targetUser && log.targetUser.id !== log.actor?.id && (
                    <span> → {log.targetUser.name}</span>
                  )}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  );
}
