import { useEffect, useState } from 'react';
import { ScrollText, User } from 'lucide-react';
import { platformRequest } from '../api';
import { Button, EmptyState, Notice, PageLoading, SectionCard } from '../components/ui/index';
import { formatCount, formatWhen } from '../lib/format';

type Audit = {
  page?: number;
  pageSize?: number;
  total?: number;
  rows: Array<{
    id: string;
    action: string;
    companyName: string | null;
    operatorEmail: string;
    reason: string | null;
    createdAt: string;
  }>;
};

export function AuditPage() {
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Audit | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    platformRequest<Audit>(`/audit?page=${page}`)
      .then((payload) => {
        setData(payload);
        setError('');
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'));
  }, [page]);

  if (error) {
    return (
      <Notice tone="error">
        Could not load platform audit trail. {error} Verify your operator role has audit read permissions.
      </Notice>
    );
  }
  if (!data) return <PageLoading label="Loading immutable compliance audit log…" />;

  const pageSize = data.pageSize || 40;
  const total = data.total ?? data.rows.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-6 pb-12">
      {data.rows.length === 0 ? (
        <EmptyState
          icon={ScrollText}
          title="No administrative mutations logged"
          description="Administrative mutations (AI limit changes, subscription overrides, staff updates) will automatically record here with required justifications."
        />
      ) : (
        <SectionCard>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Action Trigger</th>
                  <th>Actor (Operator)</th>
                  <th>Target Organization</th>
                  <th>Operator Justification</th>
                  <th>Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <span className="inline-flex rounded-md bg-slate-100 px-2 py-0.5 font-mono text-xs font-bold text-slate-800">
                        {row.action}
                      </span>
                    </td>
                    <td>
                      <div className="flex items-center gap-1.5 text-xs font-medium text-slate-800">
                        <User className="h-3.5 w-3.5 text-slate-400" />
                        {row.operatorEmail}
                      </div>
                    </td>
                    <td>
                      <span className="text-xs font-semibold text-slate-900">{row.companyName || 'Platform Global'}</span>
                    </td>
                    <td>
                      <span className="text-xs text-slate-600">{row.reason || '—'}</span>
                    </td>
                    <td>
                      <span className="text-xs font-mono text-slate-500" title={new Date(row.createdAt).toLocaleString()}>
                        {formatWhen(row.createdAt)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}

      {pageCount > 1 && (
        <div className="flex items-center justify-between border-t border-slate-200/80 pt-4 text-sm">
          <Button
            variant="secondary"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
          >
            Previous
          </Button>
          <span className="font-mono text-xs font-semibold text-slate-600">
            Page {page} of {pageCount} ({formatCount(total)} total entries)
          </span>
          <Button
            variant="secondary"
            size="sm"
            disabled={page >= pageCount}
            onClick={() => setPage(page + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
