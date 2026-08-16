import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Search } from 'lucide-react';
import { platformRequest } from '../api';
import { LifecycleRail } from '../components/LifecycleRail';
import { EmptyState, FlagPills, Input, Notice, ResponsiveDataView, StatusBadge } from '../components/ui';
import { formatCount, formatWhen } from '../lib/format';
import { toStackedAccountRecord, type AccountListRow } from '../lib/records';
import { ACTIVATION_STAGES, type ActivationStage } from '../lib/stages';

export function AccountsPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState(params.get('q') || '');
  const stage = (params.get('stage') || '') as ActivationStage | '';
  const page = Math.max(1, Number(params.get('page') || 1));
  const [rows, setRows] = useState<AccountListRow[]>([]);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState('');

  useEffect(() => {
    const handle = window.setTimeout(() => {
      const search = new URLSearchParams();
      if (q) search.set('q', q);
      if (stage && ACTIVATION_STAGES.includes(stage)) search.set('stage', stage);
      search.set('page', String(page));
      platformRequest<{ rows: AccountListRow[]; total: number }>(`/orgs?${search.toString()}`)
        .then((data) => {
          setRows(data.rows);
          setTotal(data.total);
          setError('');
        })
        .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'));
    }, 250);
    return () => window.clearTimeout(handle);
  }, [q, stage, page]);

  function setStage(next?: ActivationStage) {
    const copy = new URLSearchParams(params);
    if (next) copy.set('stage', next);
    else copy.delete('stage');
    copy.delete('page');
    setParams(copy);
  }

  const records = rows.map(toStackedAccountRecord);
  const pageCount = Math.max(1, Math.ceil(total / 25));

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold tracking-tight">Accounts</h1>
      <div className="rounded-2xl border border-dust bg-white p-4">
        <LifecycleRail current={stage || undefined} onSelect={setStage} compact />
      </div>
      <Input
        label="Search company or owner email"
        value={q}
        onChange={(event) => {
          setQ(event.target.value);
          const copy = new URLSearchParams(params);
          if (event.target.value) copy.set('q', event.target.value);
          else copy.delete('q');
          copy.delete('page');
          setParams(copy);
        }}
      />
      {error && <Notice tone="error">{error}</Notice>}
      <ResponsiveDataView
        items={records}
        emptyState={
          <EmptyState
            icon={Search}
            title="No accounts in this filter"
            description="Clear the stage rail or search to see more organizations."
          />
        }
        renderCard={(row) => (
          <button
            type="button"
            className="w-full rounded-2xl border border-dust bg-white p-4 text-left"
            onClick={() => navigate(`/accounts/${row.id}`)}
          >
            <p className="font-semibold">{row.title}</p>
            <p className="text-xs text-ink/50">{row.subtitle}</p>
            <div className="mt-3">
              <LifecycleRail current={row.stage} compact />
            </div>
            <div className="mt-3 flex items-center justify-between gap-2">
              <StatusBadge status={row.plan} />
              <FlagPills flags={row.flags} />
            </div>
          </button>
        )}
        renderTable={() => (
          <div className="overflow-x-auto rounded-2xl border border-dust bg-white">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-paper text-xs uppercase tracking-wide text-ink/50">
                <tr>
                  <th className="px-4 py-3">Company</th>
                  <th className="px-4 py-3">Stage</th>
                  <th className="px-4 py-3">Plan</th>
                  <th className="px-4 py-3">Quality</th>
                  <th className="px-4 py-3">AI</th>
                  <th className="px-4 py-3">Last login</th>
                  <th className="px-4 py-3">Flags</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.id}
                    className="cursor-pointer border-t border-dust hover:bg-sage-faint/50"
                    onClick={() => navigate(`/accounts/${row.id}`)}
                  >
                    <td className="px-4 py-3">
                      <div className="font-semibold">{row.companyName}</div>
                      <div className="text-xs text-ink/50">{row.ownerEmail}</div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">{row.stage}</td>
                    <td className="px-4 py-3">{row.plan}</td>
                    <td className="px-4 py-3">
                      {row.qualityRating ? <StatusBadge status={row.qualityRating} /> : '—'}
                    </td>
                    <td className="px-4 py-3 font-mono">{formatCount(row.aiTokensMonth)}</td>
                    <td className="px-4 py-3 text-xs">{formatWhen(row.lastLoginAt)}</td>
                    <td className="px-4 py-3">
                      <FlagPills flags={row.flags} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      />
      {pageCount > 1 && (
        <div className="flex items-center justify-between text-sm">
          <button
            type="button"
            className="text-ink/60 disabled:opacity-40"
            disabled={page <= 1}
            onClick={() => {
              const copy = new URLSearchParams(params);
              copy.set('page', String(page - 1));
              setParams(copy);
            }}
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
            onClick={() => {
              const copy = new URLSearchParams(params);
              copy.set('page', String(page + 1));
              setParams(copy);
            }}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
