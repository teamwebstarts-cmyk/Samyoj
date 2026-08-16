import { useEffect, useState } from 'react';
import { ScrollText } from 'lucide-react';
import { platformRequest } from '../api';
import { EmptyState, Notice } from '../components/ui/index';
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

  if (error) return <Notice tone="error">{error}</Notice>;
  if (!data) return <p className="text-sm text-ink/55">Loading audit…</p>;

  const pageSize = data.pageSize || 40;
  const total = data.total ?? data.rows.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Audit</h1>
      {data.rows.length === 0 ? (
        <EmptyState icon={ScrollText} title="No audit entries" description="Operator writes appear here." />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-dust bg-white">
          {data.rows.map((row) => (
            <div key={row.id} className="border-b border-dust px-4 py-3 last:border-0">
              <p className="font-semibold">{row.action}</p>
              <p className="text-xs text-ink/50">
                {row.operatorEmail} · {row.companyName || 'platform'} · {row.reason} · {formatWhen(row.createdAt)}
              </p>
            </div>
          ))}
        </div>
      )}
      {pageCount > 1 && (
        <div className="flex items-center justify-between text-sm">
          <button type="button" className="text-ink/60 disabled:opacity-40" disabled={page <= 1} onClick={() => setPage(page - 1)}>
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
