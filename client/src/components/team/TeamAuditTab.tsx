import { useCallback, useEffect, useState } from 'react';
import { ClipboardList, RefreshCw } from 'lucide-react';
import AppButton from '../ui/AppButton';
import DataTable from '../ui/DataTable';
import EmptyState from '../ui/EmptyState';
import ListLayoutSkeleton from '../ui/ListLayoutSkeleton';
import { teamApi } from '../../services/api';
import { auditActionLabels, formatRelativeTime } from './teamUi';

interface AuditLog {
  id: string;
  action: string;
  createdAt: string;
  metadata?: Record<string, unknown> | null;
  actor?: { id: string; name: string; email: string } | null;
  targetUser?: { id: string; name: string; email: string } | null;
}

export default function TeamAuditTab() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    teamApi
      .audit(100)
      .then(({ data }) => setLogs(data.data.logs || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="inbox-shell overflow-hidden">
      <div className="flex items-center justify-end border-b border-theme-border px-4 py-3.5 sm:px-5">
        <AppButton variant="secondary" size="sm" icon={<RefreshCw size={15} />} onClick={load}>
          Refresh
        </AppButton>
      </div>

      {loading && logs.length === 0 ? (
        <ListLayoutSkeleton label="Loading audit log" tableHeaders={['Action', 'Actor', 'Target', 'When']} />
      ) : logs.length === 0 ? (
        <div className="p-4 sm:p-6">
          <EmptyState
            icon={ClipboardList}
            title="No activity logged yet"
            description="Team changes like invites, role updates, and settings edits will show up here."
            compact
          />
        </div>
      ) : (
        <div className="px-4 pb-5 pt-4 sm:px-5">
          <DataTable
            headers={['Action', 'Actor', 'Target', 'When']}
            serialNo={false}
            className="border-0 bg-transparent shadow-none"
          >
            {logs.map((log) => (
              <tr key={log.id} className="border-t border-theme-border hover:bg-theme-subtle/40">
                <td className="px-5 py-3.5">
                  <p className="font-semibold text-theme-fg">
                    {auditActionLabels[log.action] || log.action}
                  </p>
                </td>
                <td className="px-5 py-3.5 text-[13px] text-theme-secondary">
                  {log.actor?.name || log.actor?.email || 'System'}
                </td>
                <td className="px-5 py-3.5 text-[13px] text-theme-secondary">
                  {log.targetUser?.name || log.targetUser?.email || '—'}
                </td>
                <td className="px-5 py-3.5 text-[12px] tabular-nums text-theme-muted">
                  {formatRelativeTime(log.createdAt)}
                </td>
              </tr>
            ))}
          </DataTable>
        </div>
      )}
    </div>
  );
}
