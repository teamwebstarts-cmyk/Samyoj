import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TriangleAlert } from 'lucide-react';
import { platformRequest } from '../api';
import {
  EmptyState,
  FilterPills,
  Notice,
  PageHeader,
  PageLoading,
  SectionCard,
  clickableRowProps,
} from '../components/ui';
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

  if (error) {
    return (
      <Notice tone="error">
        Could not load Meta errors. {error} Refresh, or try the other window.
      </Notice>
    );
  }
  if (!data) return <PageLoading label="Loading errors…" />;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Meta errors"
        purpose="Official codes only. No wa_id, wamid, or send payloads. Open an org to see its cluster."
        action={
          <FilterPills
            label="Window"
            value={days}
            onChange={setDays}
            options={[
              { value: 7, label: '7 days' },
              { value: 30, label: '30 days' },
            ]}
          />
        }
      />
      {data.codes.length === 0 ? (
        <EmptyState
          icon={TriangleAlert}
          title="No clustered codes"
          description="Failed sends aggregate here after Meta returns an error code."
          steps={['Wait for a failed send', 'Open the org file from Accounts if you already know who is stuck']}
        />
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {data.codes.map((row) => (
            <div key={row.code} className="dashboard-card p-[var(--card-pad)]">
              <p className="font-mono text-base">{row.code}</p>
              <p className="mt-0.5 text-[13px] leading-snug">{row.title}</p>
              <p className="mt-1.5 font-mono text-[11px] text-ink/50">{formatCount(row.count)} this window</p>
            </div>
          ))}
        </div>
      )}
      <SectionCard title="Recent org hits" purpose="Open an account’s Errors tab.">
        {data.recent.length === 0 ? (
          <p className="p-[var(--card-pad)] text-[13px] text-ink/50">No org-level hits in this window.</p>
        ) : (
          <>
            <div className="divide-y divide-dust md:hidden">
              {data.recent.map((row, index) => (
                <button
                  type="button"
                  key={`${row.organizationId}-${row.code}-${index}`}
                  className="block w-full px-3 py-2.5 text-left hover:bg-sage-faint/60"
                  onClick={() => navigate(`/accounts/${row.organizationId}?tab=errors`)}
                >
                  <p className="font-semibold">{row.companyName}</p>
                  <p className="font-mono text-sm">
                    {row.code} · {row.title} × {formatCount(row.count)}
                  </p>
                  <p className="text-xs text-ink/50">
                    {row.sampleTitle} · {formatWhen(row.lastAt)}
                  </p>
                </button>
              ))}
            </div>
            <div className="hidden overflow-x-auto md:block">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Company</th>
                    <th>Code</th>
                    <th>Count</th>
                    <th>Last</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recent.map((row, index) => (
                    <tr
                      key={`${row.organizationId}-${row.code}-${index}`}
                      {...clickableRowProps(() => navigate(`/accounts/${row.organizationId}?tab=errors`))}
                    >
                      <td>
                        <p className="font-semibold">{row.companyName}</p>
                        <p className="text-xs text-ink/50">{row.sampleTitle || row.title}</p>
                      </td>
                      <td className="font-mono">{row.code}</td>
                      <td className="font-mono">{formatCount(row.count)}</td>
                      <td className="text-xs">{formatWhen(row.lastAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </SectionCard>
    </div>
  );
}
