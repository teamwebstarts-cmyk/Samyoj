import { useEffect, useState } from 'react';
import { ScrollText } from 'lucide-react';
import { platformRequest } from '../api';
import { EmptyState, Notice, PageHeader, PageLoading, SectionCard } from '../components/ui/index';
import { formatWhen } from '../lib/format';

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
        Could not load audit. {error} Refresh, or confirm your role can read audit.
      </Notice>
    );
  }
  if (!data) return <PageLoading label="Loading audit…" />;

  const pageSize = data.pageSize || 40;
  const total = data.total ?? data.rows.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-4">
      <PageHeader
        title="Audit"
        purpose="Operator writes only — AI caps, flags, billing, outreach, staff. Reasons are required."
      />
      {data.rows.length === 0 ? (
        <EmptyState
          icon={ScrollText}
          title="No audit entries"
          description="Operator writes appear here. ANALYST browsing does not."
        />
      ) : (
        <SectionCard>
          <div className="overflow-x-auto">
            <table className="data-table hidden md:table">
              <thead>
                <tr>
                  <th>Action</th>
                  <th>Operator</th>
                  <th>Account</th>
                  <th>Reason</th>
                  <th>When</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row) => (
                  <tr key={row.id}>
                    <td className="font-semibold">{row.action}</td>
                    <td className="text-xs">{row.operatorEmail}</td>
                    <td className="text-xs">{row.companyName || 'platform'}</td>
                    <td className="text-xs text-ink/60">{row.reason || '—'}</td>
                    <td className="text-xs">{formatWhen(row.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="divide-y divide-dust md:hidden">
              {data.rows.map((row) => (
                <div key={row.id} className="px-3 py-2.5">
                  <p className="font-semibold">{row.action}</p>
                  <p className="mt-1 text-xs text-ink/50">
                    {row.operatorEmail} · {row.companyName || 'platform'} · {row.reason} · {formatWhen(row.createdAt)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </SectionCard>
      )}
      {pageCount > 1 && (
        <div className="flex items-center justify-between text-sm">
          <button
            type="button"
            className="text-ink/60 disabled:opacity-40"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
          >
            Previous
          </button>
          <span className="font-mono text-xs">
            {page} / {pageCount}
          </span>
          <button
            type="button"
            className="text-ink/60 disabled:opacity-40"
            disabled={page >= pageCount}
            onClick={() => setPage(page + 1)}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
