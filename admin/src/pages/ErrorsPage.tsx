import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TriangleAlert } from 'lucide-react';
import { platformRequest } from '../api';
import { EmptyState, Notice, StatusBadge } from '../components/ui';
import { formatCount, formatWhen } from '../lib/format';

type Errors = {
  days: number;
  codes: Array<{ code: number; title: string; count: number; sampleTitle: string | null }>;
  recent: Array<{
    organizationId: string;
    companyName: string;
    code: number;
    title: string;
    count: number;
    sampleTitle: string | null;
    lastAt: string;
  }>;
};

export function ErrorsPage() {
  const navigate = useNavigate();
  const [days, setDays] = useState(7);
  const [data, setData] = useState<Errors | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    platformRequest<Errors>(`/errors?days=${days}`)
      .then((payload) => {
        setData(payload);
        setError('');
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'));
  }, [days]);

  if (error) return <Notice tone="error">{error}</Notice>;
  if (!data) return <p className="text-sm text-ink/55">Loading errors…</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Meta errors</h1>
          <p className="mt-1 text-sm text-ink/55">Official codes only. No wa_id, wamid, or send payloads.</p>
        </div>
        <select
          className="h-11 rounded-lg border border-dust bg-white px-3 text-sm"
          value={days}
          onChange={(event) => setDays(Number(event.target.value))}
        >
          <option value={7}>7 days</option>
          <option value={30}>30 days</option>
        </select>
      </div>
      {data.codes.length === 0 ? (
        <EmptyState
          icon={TriangleAlert}
          title="No clustered codes"
          description="Failed sends aggregate here after Meta returns an error code."
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-3">
          {data.codes.map((row) => (
            <div key={row.code} className="rounded-xl border border-dust bg-white p-4">
              <p className="font-mono text-lg">{row.code}</p>
              <p className="text-sm">{row.title}</p>
              <p className="mt-2 font-mono text-xs">{formatCount(row.count)}</p>
            </div>
          ))}
        </div>
      )}
      <div className="overflow-hidden rounded-2xl border border-dust bg-white">
        {data.recent.map((row, index) => (
          <button
            type="button"
            key={`${row.organizationId}-${row.code}-${index}`}
            className="block w-full border-b border-dust px-4 py-3 text-left last:border-0 hover:bg-sage-faint/40"
            onClick={() => navigate(`/accounts/${row.organizationId}?tab=errors`)}
          >
            <p className="font-semibold">{row.companyName}</p>
            <p className="font-mono text-sm">
              {row.code} · {row.title} × {row.count}
            </p>
            <p className="text-xs text-ink/50">
              {row.sampleTitle} · {formatWhen(row.lastAt)}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}
