import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Search } from 'lucide-react';
import { platformRequest } from '../api';
import { LifecycleRail } from '../components/LifecycleRail';
import {
  Button,
  EmptyState,
  FlagPills,
  Input,
  Notice,
  PageHeader,
  PageLoading,
  ResponsiveDataView,
  SectionCard,
  StageBadge,
  StatusBadge,
  clickableRowProps,
} from '../components/ui';
import { formatAiCapPercent, formatCount, formatWhen } from '../lib/format';
import { toStackedAccountRecord, type AccountListRow } from '../lib/records';
import { ACTIVATION_STAGES, STAGE_LABELS, type ActivationStage } from '../lib/stages';

export function AccountsPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState(params.get('q') || '');
  const stage = (params.get('stage') || '') as ActivationStage | '';
  const page = Math.max(1, Number(params.get('page') || 1));
  const [rows, setRows] = useState<AccountListRow[] | null>(null);
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
    if (next && next !== stage) copy.set('stage', next);
    else copy.delete('stage');
    copy.delete('page');
    setParams(copy);
  }

  const records = (rows ?? []).map(toStackedAccountRecord);
  const pageCount = Math.max(1, Math.ceil(total / 25));
  const purpose = stage
    ? `${STAGE_LABELS[stage]} · ${formatCount(total)} matching`
    : 'Search company or owner email. Filter the rail to a stage.';

  return (
    <div className="space-y-4">
      <PageHeader
        title="Accounts"
        purpose={purpose}
        action={
          stage ? (
            <Button variant="secondary" onClick={() => setStage()}>
              Clear stage
            </Button>
          ) : undefined
        }
      />
      <SectionCard padded>
        <LifecycleRail current={stage || undefined} onSelect={setStage} compact />
      </SectionCard>
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
      {error && (
        <Notice tone="error">
          Could not load accounts. {error} Clear filters or refresh.
        </Notice>
      )}
      {rows === null && !error ? (
        <PageLoading label="Loading accounts…" />
      ) : (
        <ResponsiveDataView
          items={records}
          emptyState={
            <EmptyState
              icon={Search}
              title="No accounts in this filter"
              description="Clear the stage rail or search to see more organizations."
              steps={['Click the selected station again to clear it', 'Search company or owner email']}
            />
          }
          renderCard={(row) => (
            <button
              type="button"
              className="dashboard-card w-full p-[var(--card-pad)] text-left"
              onClick={() => navigate(`/accounts/${row.id}`)}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">{row.title}</p>
                  <p className="text-xs text-ink/50">{row.subtitle}</p>
                </div>
                <StageBadge stage={row.stage} />
              </div>
              <div className="mt-2">
                <LifecycleRail current={row.stage} compact decorative />
              </div>
              <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-ink/55">
                <span>{row.numbersConnected} numbers</span>
                <span className="font-mono">{formatAiCapPercent(row.aiTokensMonth, row.monthlyTokenLimit)}</span>
              </div>
              <div className="mt-2 flex items-center justify-between gap-2">
                <StatusBadge status={row.plan} />
                <FlagPills flags={row.flags} />
              </div>
            </button>
          )}
          renderTable={() => (
            <div className="dashboard-card overflow-hidden">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Company</th>
                    <th>Stage</th>
                    <th>Plan</th>
                    <th>Quality</th>
                    <th>AI % of cap</th>
                    <th>Numbers</th>
                    <th>Last login</th>
                    <th>Flags</th>
                  </tr>
                </thead>
                <tbody>
                  {(rows ?? []).map((row) => (
                    <tr key={row.id} {...clickableRowProps(() => navigate(`/accounts/${row.id}`))}>
                      <td>
                        <div className="font-semibold">{row.companyName}</div>
                        <div className="text-xs text-ink/50">{row.ownerEmail}</div>
                      </td>
                      <td>
                        <StageBadge stage={row.stage} />
                      </td>
                      <td>
                        <StatusBadge status={row.plan} />
                      </td>
                      <td>{row.qualityRating ? <StatusBadge status={row.qualityRating} /> : '—'}</td>
                      <td className="font-mono text-xs">
                        {formatAiCapPercent(row.aiTokensMonth, row.monthlyTokenLimit)}
                      </td>
                      <td className="font-mono">{formatCount(row.numbersConnected)}</td>
                      <td className="text-xs">{formatWhen(row.lastLoginAt)}</td>
                      <td>
                        <FlagPills flags={row.flags} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        />
      )}
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
